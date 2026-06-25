<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\Intervention;
use App\Models\QrCode;
use App\Models\TelemanagementLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Télégestion : QR codes par adresse + checkins (arrivée/départ) + logs.
 *
 * Règles métier (cf modifications docx) :
 *   - 1 QR code unique par adresse client
 *   - Le badgeage horodate un checkin lié à une intervention
 *   - Si admin/super_admin : possibilité de saisie manuelle (oubli de badgeage)
 *   - Possibilité de créer une intervention par badgeage direct (arrivée/départ
 *     chez un client sans intervention planifiée)
 *
 * audit 2026-05-19 :
 *   - badge() vérifie l'expiration du QR (410 Gone)
 *   - badge() bloque double-arrival (409 Conflict) et fermeture sans arrival ouvert
 *   - badge() flag_no_gps si lat/lng absents (mode dégradé)
 *   - manualEntry() retourne aussi un log enrichi de comment
 */
class TelemanagementController extends Controller
{
    // ========== QR CODES ==========

    public function listQrCodes(Request $request)
    {
        abort_unless($request->user()?->can('telemanagement.badge'), 403);

        // 2026-06-08 — réponse enrichie : address + client + company.
        // Adresses polymorphes (`owner_type`/`owner_id`) → on charge l'`owner`
        // morphTo en limitant aux clients. Le client est ensuite serialisé via
        // un transformer maison pour aplatir la company.
        $request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'status' => ['nullable', 'in:valid,obsolete,invalid,to_validate'],
        ]);

        $query = QrCode::query()
            ->with([
                'address:id,owner_type,owner_id,address,postal_code,city',
                'address.owner' => function ($morph) {
                    // L'owner est polymorphique : on charge la company seulement
                    // sur les Clients (les autres morphs n'ont pas de company).
                    $morph->morphWith([
                        \App\Models\Client::class => [
                            'company:client_id,company_name',
                        ],
                    ]);
                },
            ])
            ->orderByDesc('id');

        if ($clientId = $request->integer('client_id')) {
            // Joint addresses pour filtrer sur le client owner (morph map = 'client').
            $query->whereHas('address', function ($q) use ($clientId) {
                $q->where('owner_type', 'client')->where('owner_id', $clientId);
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $rows = $query->get()->map(function (QrCode $qr) {
            $addr = $qr->address;
            $client = null;
            if ($addr && $addr->owner_type === 'client' && $addr->owner instanceof \App\Models\Client) {
                $owner = $addr->owner;
                $client = [
                    'id' => $owner->id,
                    'code' => $owner->code,
                    'company_name' => $owner->company?->company_name,
                ];
            }

            return [
                'id' => $qr->id,
                'code' => $qr->code,
                'status' => $qr->status,
                'type' => $qr->type,
                'expires_at' => $qr->expires_at,
                'address' => $addr ? [
                    'id' => $addr->id,
                    'address' => $addr->address,
                    'postal_code' => $addr->postal_code,
                    'city' => $addr->city,
                    'client' => $client,
                ] : null,
            ];
        });

        return ['data' => $rows];
    }

    /**
     * 2026-06-24 — Suppression d'un QR code.
     *
     * Comportement à 2 étages selon usage :
     *  - QR jamais badgé (0 checkin lié) → hard-delete (`force=1`) ou
     *    désactivation (statut `obsolete`) selon le param `force`.
     *  - QR badgé au moins une fois → on ne peut PAS le hard-delete
     *    (les checkins sont liés via `checkins.qr_code_id` — référence
     *    de traçabilité de présence). On le passe en `obsolete` :
     *    il devient inutilisable pour un nouveau badge mais l'historique
     *    reste consultable.
     *
     * Par défaut (sans `force=1`) : désactivation systématique.
     */
    public function deleteQrCode(Request $request, QrCode $qrCode)
    {
        abort_unless(
            $request->user()?->hasAnyRole(['super_admin', 'admin']),
            403,
            "Suppression QR réservée aux admins.",
        );

        $force = $request->boolean('force');
        $checkinsCount = $qrCode->checkins()->count();

        if ($force && $checkinsCount > 0) {
            return response()->json([
                'message' => "Suppression impossible : ce QR a été utilisé pour {$checkinsCount} badgeage(s). Révoque-le (statut obsolete) pour le retirer sans casser l'historique de présence.",
            ], 409);
        }

        if ($force) {
            $qrCode->delete();
            return response()->noContent();
        }

        $qrCode->update(['status' => 'obsolete']);
        return response()->noContent();
    }

    public function generateQrCode(Request $request)
    {
        // 2026-06-24 — permission corrigée : `admin.users.manage` était réservée
        // à la gestion des comptes utilisateurs et bloquait les admins qui
        // voulaient générer un QR client. Le bon scope = rôle admin ou
        // super_admin (action de configuration métier, pas de gestion users).
        abort_unless(
            $request->user()?->hasAnyRole(['super_admin', 'admin']),
            403,
            "Génération de QR réservée aux admins.",
        );
        $data = $request->validate([
            'address_id' => ['required', 'exists:addresses,id'],
            'type' => ['required', 'in:qrcode,nfc'],
            'expires_at' => ['nullable', 'date', 'after:now'], // audit 2026-05-19
        ]);

        // 1 seul QR actif par adresse : on désactive les anciens
        QrCode::where('address_id', $data['address_id'])
            ->where('status', 'valid')
            ->update(['status' => 'obsolete']);

        $code = Str::upper(Str::random(16));

        $qr = QrCode::create([
            'address_id' => $data['address_id'],
            'type' => $data['type'],
            'code' => $code,
            'status' => 'valid',
            'expires_at' => $data['expires_at'] ?? null, // audit 2026-05-19
        ]);

        return response()->json(['data' => $qr], 201);
    }

    // ========== CHECKINS (badgeage) ==========

    /**
     * POST /api/v1/telemanagement/badge
     *
     * Badgeage par scan QR. Crée un checkin et alimente le log.
     * Si l'intervention n'existe pas, on peut la créer à la volée (cf modifications docx).
     */
    public function badge(Request $request)
    {
        abort_unless($request->user()?->can('telemanagement.badge'), 403);

        $data = $request->validate([
            'qr_code' => ['required', 'string'],
            // employee_id est OPTIONNEL : dans le flow mobile, le user
            // authentifié EST l'intervenant qui scanne → on dérive son
            // employee_id côté serveur. Conservé pour le flow web admin
            // (saisie pour un autre intervenant) qui doit le passer explicitement.
            'employee_id' => ['sometimes', 'nullable', 'exists:employees,id'],
            'intervention_id' => ['nullable', 'exists:interventions,id'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'event_type' => ['required', 'in:arrival,departure'],
            // Si pas d'intervention liée, on peut en créer une depuis le badge
            'create_intervention_if_missing' => ['nullable', 'boolean'],
            'client_id' => ['nullable', 'exists:clients,id'],  // requis si create_intervention_if_missing
        ]);

        // Si l'appelant ne fournit pas employee_id, on le dérive du user
        // authentifié (cas mobile : l'intervenant qui scanne EST le user).
        if (empty($data['employee_id'])) {
            $employee = $request->user()?->employee;
            abort_unless($employee, 422, "Ce compte n'est pas rattaché à un intervenant");
            $data['employee_id'] = $employee->id;
        }

        $qr = QrCode::where('code', $data['qr_code'])
            ->where('status', 'valid')
            ->first();
        abort_unless($qr, 404, "QR code inconnu ou obsolète");

        // audit 2026-05-19 — QR expiré → 410 Gone
        if ($qr->expires_at && $qr->expires_at->isPast()) {
            abort(410, "QR code expiré le " . $qr->expires_at->format('d/m/Y H:i'));
        }

        return DB::transaction(function () use ($data, $qr, $request) {
            // Si pas d'intervention liée et flag create → on en crée une
            $interventionId = $data['intervention_id'] ?? null;
            if (! $interventionId && ! empty($data['create_intervention_if_missing'])) {
                abort_unless(! empty($data['client_id']), 422, "client_id requis pour créer l'intervention");
                $now = now();
                $intervention = Intervention::create([
                    'client_id' => $data['client_id'],
                    'employee_id' => $data['employee_id'],
                    'is_recurring' => false,
                    'status' => 'realisee',
                    'start_datetime' => $now,
                    'end_datetime' => $now->copy()->addHour(),
                    'comment' => 'Créée automatiquement via badgeage QR',
                ]);
                $interventionId = $intervention->id;
            }

            // audit 2026-05-19 — anti double-badge : on contrôle la cohérence
            // arrival/departure sur le couple (employee, intervention).
            if ($interventionId) {
                $openCheckin = Checkin::where('employee_id', $data['employee_id'])
                    ->where('intervention_id', $interventionId)
                    ->whereNull('checkout_time')
                    ->whereNotNull('checkin_time')
                    ->latest('checkin_time')
                    ->first();

                if ($data['event_type'] === 'arrival' && $openCheckin) {
                    abort(409, "Pointage déjà en cours pour cet intervenant sur cette intervention");
                }

                if ($data['event_type'] === 'departure') {
                    if (! $openCheckin) {
                        abort(409, "Aucun pointage d'arrivée à fermer pour cet intervenant");
                    }
                    // On ferme le checkin existant plutôt que d'en créer un nouveau
                    // → cohérence des données (1 ligne par séance pointée).
                    $openCheckin->update([
                        'checkout_time' => now(),
                        'latitude' => $data['latitude'] ?? $openCheckin->latitude,
                        'longitude' => $data['longitude'] ?? $openCheckin->longitude,
                    ]);

                    TelemanagementLog::create([
                        'origin' => 'mobile',
                        'event_type' => 'departure',
                        'is_unrecognized' => false,
                        'called_at' => now(),
                        'employee_id' => $data['employee_id'],
                        'client_id' => $data['client_id'] ?? null,
                        'intervention_id' => $interventionId,
                    ]);

                    return response()->json([
                        'data' => [
                            'checkin' => $openCheckin->fresh(),
                            'intervention_id' => $interventionId,
                            'qr_code' => $qr->code,
                        ],
                    ], 200);
                }
            }

            // audit 2026-05-19 — flag mode dégradé si pas de GPS
            $hasGps = isset($data['latitude'], $data['longitude'])
                && $data['latitude'] !== null && $data['longitude'] !== null;

            $checkin = Checkin::create([
                'employee_id' => $data['employee_id'],
                'intervention_id' => $interventionId,
                'qr_code_id' => $qr->id,
                'checkin_time' => $data['event_type'] === 'arrival' ? now() : null,
                'checkout_time' => $data['event_type'] === 'departure' ? now() : null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'flag_no_gps' => ! $hasGps, // audit 2026-05-19
            ]);

            TelemanagementLog::create([
                'origin' => 'mobile',
                'event_type' => $data['event_type'],
                'is_unrecognized' => false,
                'called_at' => now(),
                'employee_id' => $data['employee_id'],
                'client_id' => $data['client_id'] ?? null,
                'intervention_id' => $interventionId,
            ]);

            $qr->update(['status' => 'valid']);  // touche updated_at implicitement

            return response()->json([
                'data' => [
                    'checkin' => $checkin->fresh(),
                    'intervention_id' => $interventionId,
                    'qr_code' => $qr->code,
                ],
            ], 201);
        });
    }

    /**
     * POST /api/v1/telemanagement/manual-entry
     *
     * Saisie manuelle par admin/super_admin (oubli de badgeage par l'intervenant).
     */
    public function manualEntry(Request $request)
    {
        abort_unless($request->user()?->can('telemanagement.manual_entry'), 403);

        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            // 2026-06-08 — passé en nullable : l'admin peut saisir un pointage
            // sans rattacher à une intervention (cas oubli + intervention non
            // créée encore, ou pointage à clarifier).
            'intervention_id' => ['sometimes', 'nullable', 'exists:interventions,id'],
            'checkin_time' => ['nullable', 'date'],
            'checkout_time' => ['nullable', 'date'],
            'comment' => ['nullable', 'string'],
        ]);

        $checkin = Checkin::create([
            'employee_id' => $data['employee_id'],
            'intervention_id' => $data['intervention_id'] ?? null,
            'checkin_time' => $data['checkin_time'] ?? null,
            'checkout_time' => $data['checkout_time'] ?? null,
            'flag_no_gps' => false, // audit 2026-05-19 — saisie manuelle = pas de GPS attendu
        ]);

        TelemanagementLog::create([
            'origin' => 'manual',
            'event_type' => $data['checkout_time'] ? 'departure' : 'arrival',
            'is_unrecognized' => false,
            'called_at' => now(),
            'employee_id' => $data['employee_id'],
            'intervention_id' => $data['intervention_id'] ?? null,
            'comment' => $data['comment'] ?? 'Saisie manuelle',
        ]);

        return response()->json(['data' => $checkin->fresh()], 201);
    }

    /**
     * GET /api/v1/telemanagement/logs?from=&to=&employee_id=
     */
    public function logs(Request $request)
    {
        abort_unless($request->user()?->can('telemanagement.badge'), 403);
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'], // 2026-06-24 audit M10
            'employee_id' => ['nullable', 'integer'],
            // 2026-06-08 — filtres ajoutés pour la refonte UI Journal.
            'event_type' => ['nullable', 'in:arrival,departure,unrecognized'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $q = TelemanagementLog::query()
            ->with(['employee:id,name', 'client:id,code'])
            ->orderByDesc('called_at');

        if ($f = $request->query('from')) $q->where('called_at', '>=', $f);
        if ($t = $request->query('to')) $q->where('called_at', '<=', $t);
        if ($e = $request->integer('employee_id')) $q->where('employee_id', $e);
        if ($et = $request->query('event_type')) $q->where('event_type', $et);

        // 2026-06-24 audit C5 — clamp per_page strict (la validation accepte
        // 1-500 mais on re-clamp avec min/max au cas où le check est
        // contourné par un re-fetch ailleurs). Défense en profondeur DoS.
        $perPage = max(1, min((int) ($request->integer('per_page') ?: 50), 500));
        return ['data' => $q->limit($perPage)->get()];
    }

    public function listCheckins(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.view'), 403);
        return ['data' => $intervention->checkins()->with('employee:id,name')->orderBy('checkin_time')->get()];
    }
}
