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
        return ['data' => QrCode::with('address')->get()];
    }

    public function generateQrCode(Request $request)
    {
        abort_unless($request->user()?->can('admin.users.manage'), 403);
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
            'employee_id' => ['required', 'exists:employees,id'],
            'intervention_id' => ['nullable', 'exists:interventions,id'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'event_type' => ['required', 'in:arrival,departure'],
            // Si pas d'intervention liée, on peut en créer une depuis le badge
            'create_intervention_if_missing' => ['nullable', 'boolean'],
            'client_id' => ['nullable', 'exists:clients,id'],  // requis si create_intervention_if_missing
        ]);

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
            'intervention_id' => ['required', 'exists:interventions,id'],
            'checkin_time' => ['nullable', 'date'],
            'checkout_time' => ['nullable', 'date'],
            'comment' => ['nullable', 'string'],
        ]);

        $checkin = Checkin::create([
            'employee_id' => $data['employee_id'],
            'intervention_id' => $data['intervention_id'],
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
            'intervention_id' => $data['intervention_id'],
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
            'to' => ['nullable', 'date'],
            'employee_id' => ['nullable', 'integer'],
        ]);

        $q = TelemanagementLog::query()
            ->with(['employee:id,name', 'client:id,code'])
            ->orderByDesc('called_at');

        if ($f = $request->query('from')) $q->where('called_at', '>=', $f);
        if ($t = $request->query('to')) $q->where('called_at', '<=', $t);
        if ($e = $request->integer('employee_id')) $q->where('employee_id', $e);

        return ['data' => $q->paginate(50)];
    }

    public function listCheckins(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.view'), 403);
        return ['data' => $intervention->checkins()->with('employee:id,name')->orderBy('checkin_time')->get()];
    }
}
