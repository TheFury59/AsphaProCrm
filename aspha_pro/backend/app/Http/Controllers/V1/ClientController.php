<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\V1\StoreClientRequest;
use App\Http\Requests\V1\UpdateClientRequest;
use App\Http\Resources\V1\ClientResource;
use App\Models\Client;
use App\Models\Intervention;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ClientController extends Controller
{
    /**
     * GET /api/v1/clients
     *
     * Filtres : ?filter[status]=active&filter[entity_id]=1&filter[search]=ducat
     * Tri    : ?sort=-created_at,code
     * Pagination : ?page=N&per_page=N (max 100)
     */
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Client::class)
            ->allowedFilters([
                'status',
                'entity_id',
                'owner_user_id',
                AllowedFilter::callback('search', function ($q, $value) {
                    $q->where(function ($sub) use ($value) {
                        $sub->where('code', 'like', "%{$value}%")
                            ->orWhereHas('company', fn ($c) => $c
                                ->where('company_name', 'like', "%{$value}%")
                                ->orWhere('siret', 'like', "%{$value}%")
                                ->orWhere('primary_email', 'like', "%{$value}%")
                            );
                    });
                }),
            ])
            ->allowedSorts(['code', 'status', 'created_at'])
            ->defaultSort('-created_at')
            ->with(['company', 'entity:id,name', 'ownerUser:id,name', 'addresses'])
            ->withCount(['missions', 'prestations', 'absences', 'keys', 'invoices', 'quotes']);

        return ClientResource::collection($query->paginate($perPage));
    }

    /**
     * GET /api/v1/clients/{client}
     */
    public function show(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $client->load([
            'company',
            'billingContact',
            'entity',
            'ownerUser:id,name,email',
            'portalUser:id,name,email,status,last_login_at',
            'addresses',
            'contacts',
            'relatedContacts',
        ])->loadCount(['missions', 'prestations', 'absences', 'keys', 'invoices', 'quotes']);

        return new ClientResource($client);
    }

    /**
     * POST /api/v1/clients
     */
    public function store(StoreClientRequest $request)
    {
        $client = DB::transaction(function () use ($request) {
            $data = $request->only([
                'code', 'status', 'entity_id', 'owner_user_id', 'print_intervention_detail',
                'intervenant_notes',
            ]);
            // Si non précisé, l'utilisateur courant devient le gestionnaire par défaut
            $data['owner_user_id'] = $data['owner_user_id'] ?? $request->user()->id;

            $client = Client::create($data);

            // Code optionnel : si l'utilisateur n'en fournit pas, on le génère
            // automatiquement à partir de l'id (unique → code unique, pas de
            // race condition). Format : CLI-0001.
            if (empty($client->code)) {
                $client->update(['code' => 'CLI-' . str_pad((string) $client->id, 4, '0', STR_PAD_LEFT)]);
            }

            // 2026-06-24 audit H6 — utiliser validated() au lieu de input()
            // pour ne JAMAIS faire fuiter une clé non whitelisted vers la
            // table client_companies. La validation est exhaustive dans
            // StoreClientRequest::rules() — toutes les sous-clés autorisées
            // y sont listées.
            $validated = $request->validated();
            $companyData = $validated['company'] ?? [];
            $client->company()->create($companyData);

            if (! empty($validated['billing_contact'] ?? null)) {
                $client->billingContact()->create($validated['billing_contact']);
            }

            return $client;
        });

        $client->load(['company', 'billingContact', 'entity', 'ownerUser:id,name']);
        return (new ClientResource($client))->response()->setStatusCode(201);
    }

    /**
     * PATCH /api/v1/clients/{client}
     */
    public function update(UpdateClientRequest $request, Client $client)
    {
        DB::transaction(function () use ($request, $client) {
            $clientFields = $request->only([
                'code', 'status', 'entity_id', 'owner_user_id', 'print_intervention_detail',
                'intervenant_notes',
            ]);
            if (! empty($clientFields)) {
                $client->update($clientFields);
            }

            // audit 2026-05-19 — refuser la création d'une ClientCompany sans company_name.
            // Sans cette garde, un PATCH partiel `{company: {phone_landline: "01..."}}` créait
            // un enregistrement company orphelin sans raison sociale (HIGH).
            // 2026-06-24 audit H6 — validated() au lieu de input() partout.
            $validated = $request->validated();

            if (array_key_exists('company', $validated) && is_array($validated['company'])) {
                $companyData = $validated['company'];
                $hasCompany = $client->company()->exists();
                if (! $hasCompany && empty($companyData['company_name'] ?? null)) {
                    abort(422, "Impossible de créer une société sans raison sociale (company_name requis).");
                }
                $client->company()->updateOrCreate(
                    ['client_id' => $client->id],
                    $companyData
                );
            }

            // audit 2026-05-19 — ne plus DELETE le billing_contact dès qu'un champ est vidé.
            // Avant : EditableField envoyait `{billing_contact: {civility: null}}` pour vider 1 champ,
            // et `empty(['civility' => null])` = true en PHP → DELETE complet (CRIT).
            // 2026-06-24 audit M4 — durcissement : exiger un FLAG explicite
            // `_purge: true` pour la suppression (au lieu d'inférer depuis "2+
            // champs tous vides"). Plus de risque qu'un PATCH partiel
            // accidentel détruise le contact de facturation.
            if (array_key_exists('billing_contact', $validated)) {
                $bc = is_array($validated['billing_contact']) ? $validated['billing_contact'] : [];
                $isExplicitPurge = ($validated['billing_contact_purge'] ?? false) === true;

                if ($isExplicitPurge) {
                    $client->billingContact()->delete();
                } elseif (count($bc) > 0) {
                    $client->billingContact()->updateOrCreate(
                        ['client_id' => $client->id],
                        $bc
                    );
                }
            }
        });

        $client->load(['company', 'billingContact', 'entity', 'ownerUser:id,name']);
        return new ClientResource($client);
    }

    /**
     * DELETE /api/v1/clients/{client}
     */
    public function destroy(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.delete'), 403);

        // audit 2026-05-19 — garde-fou anti-orphelins : refuser la suppression si des
        // interventions futures sont liées (le client a encore des RDV planifiés). L'admin
        // peut forcer via ?force=1 mais doit le faire explicitement.
        $force = $request->boolean('force');
        $isSuperAdmin = $request->user()?->hasRole('super_admin') ?? false;

        if (! $force) {
            $futureCount = Intervention::where('client_id', $client->id)
                ->where('start_datetime', '>=', now())
                ->whereNotIn('status', ['annulee', 'realisee', 'terminated'])
                ->count();
            if ($futureCount > 0) {
                abort(409, "Impossible de supprimer : {$futureCount} intervention(s) future(s) liée(s). Annulez ou réassignez-les d'abord, ou forcez via ?force=1 (admin uniquement).");
            }
        } elseif (! $isSuperAdmin) {
            abort(403, "Seul un super-admin peut forcer la suppression d'un client avec interventions futures.");
        }

        $client->delete();
        return response()->noContent();
    }
}
