<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientPrestation;
use App\Models\Mission;
use App\Models\MissionStockItem;
use App\Services\MissionQuoteGenerator;
use App\Services\MissionStockService;
use App\Services\RecurringInterventionGenerator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

/**
 * Missions client + prestations contractualisées rattachées.
 *
 * Hiérarchie métier (cf. cahier des charges) :
 *   Client → 1..N Missions → 1..N Prestations contractualisées → Devis/Factures
 *
 * Une mission représente un "contrat de service" (ex: "Ménage hebdomadaire chez
 * M. Dupont"). Elle agrège plusieurs prestations (ex: "Repassage", "Vitres", etc.)
 * qui ont chacune leur tarif (héritage produit catalogue OU prix custom).
 */
class MissionController extends Controller
{
    /**
     * GET /api/v1/missions
     *
     * Liste globale paginée de toutes les missions (page menu "Missions").
     * Filtres : status, client_id, search (sur nom mission OU raison sociale client).
     */
    public function indexAll(Request $request)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = Mission::query()
            ->with([
                'client:id,code',
                'client.company:id,client_id,company_name,photo,updated_at',
                'clientPrestations.product:id,name,code,price',
                'quote:id,reference',
            ])
            ->withCount('clientPrestations');

        if ($status = $request->query('filter.status')) {
            $query->where('status', $status);
        }
        if ($clientId = $request->integer('filter.client_id')) {
            $query->where('client_id', $clientId);
        }
        if ($search = $request->query('filter.search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$search%"));
            });
        }

        return ['data' => $query->orderByDesc('id')->paginate($perPage)];
    }

    public function index(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->missions()
            ->with(['clientPrestations.product:id,name,code,price,default_duration_minutes', 'quote:id,reference'])
            ->orderByDesc('id')
            ->get()];
    }

    public function show(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        $mission->load([
            'client:id,code',
            'client.company:id,client_id,company_name,photo,updated_at',
            'clientPrestations.product',
            'quote:id,reference',
        ]);
        return ['data' => $mission];
    }

    public function store(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,suspended,cancelled'],
            'quote_id' => ['nullable', 'exists:quotes,id'],
            'no_intervention_no_bill' => ['nullable', 'boolean'],
            'payment_methods' => ['nullable', 'string', 'max:255'],
            'online_payment_enabled' => ['nullable', 'boolean'],
            'billing_rhythm' => ['nullable', 'string', 'max:64'],

            // Création en batch : on accepte une liste de prestations à attacher
            // à la mission dès sa création (flow Xelya : 1 page = 1 mission + N prestations)
            'prestations' => ['nullable', 'array'],
            ...$this->prestationRules('prestations.*.'),
        ]);
        $data['status'] = $data['status'] ?? 'active';
        $prestations = $data['prestations'] ?? [];
        unset($data['prestations']);

        $userId = $request->user()->id;

        $mission = DB::transaction(function () use ($client, $data, $prestations, $userId) {
            $mission = $client->missions()->create($data);
            $generator = app(RecurringInterventionGenerator::class);

            /** @var Collection<int,ClientPrestation> $createdPrestations */
            $createdPrestations = collect();

            foreach ($prestations as $p) {
                $p = $this->normalizePrestationData($p);
                $p['mission_id'] = $mission->id;
                $p['client_id'] = $client->id;
                $prestation = ClientPrestation::create($p);
                $createdPrestations->push($prestation);

                // Étape 3 — génère l'intervention récurrente modèle si nature=regular.
                // Ponctuelle : aucune génération (RDV créés manuellement au planning).
                $generator->syncForPrestation($prestation);
            }

            // 2026-05-21 — devis brouillon auto à la création d'une mission avec
            // prestations. Anti-doublon géré par le service (missions.quote_id).
            if ($createdPrestations->isNotEmpty()) {
                app(MissionQuoteGenerator::class)->generateForMission(
                    $mission,
                    $createdPrestations,
                    $userId,
                );
            }

            return $mission;
        });

        return response()->json([
            'data' => $mission->fresh(['clientPrestations.product', 'quote:id,reference,status']),
        ], 201);
    }

    public function update(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $mission->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:active,suspended,cancelled'],
            'quote_id' => ['sometimes', 'nullable', 'exists:quotes,id'],
            'no_intervention_no_bill' => ['sometimes', 'boolean'],
            'payment_methods' => ['sometimes', 'nullable', 'string', 'max:255'],
            'online_payment_enabled' => ['sometimes', 'boolean'],
            'billing_rhythm' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]));
        return ['data' => $mission->fresh(['clientPrestations.product'])];
    }

    public function destroy(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        // Garde-fou : empêche la suppression si des prestations sont actives
        $activePrestations = $mission->clientPrestations()
            ->whereNull('end_date')
            ->count();
        if ($activePrestations > 0) {
            return response()->json([
                'message' => "Impossible de supprimer : {$activePrestations} prestation(s) encore active(s). Termine-les d'abord.",
            ], 422);
        }

        $mission->delete();  // soft delete
        return response()->noContent();
    }

    // ========== PRESTATIONS DE LA MISSION ==========

    public function listPrestations(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $mission->clientPrestations()
            ->with([
                'product:id,name,code,price,default_duration_minutes',
                'quote:id,reference',
                'defaultEmployee:id,name',
            ])
            ->orderBy('start_date')
            ->get()];
    }

    public function storePrestation(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $data = $request->validate([
            ...$this->prestationRules(),
            'quote_id' => ['nullable', 'exists:quotes,id'],
        ]);
        $data = $this->normalizePrestationData($data);
        $data['mission_id'] = $mission->id;
        $data['client_id'] = $mission->client_id;

        $prestation = DB::transaction(function () use ($data) {
            $prestation = ClientPrestation::create($data);
            // Étape 3 — génère l'intervention récurrente modèle si nature=regular.
            app(RecurringInterventionGenerator::class)->syncForPrestation($prestation);
            return $prestation;
        });

        return response()->json(['data' => $prestation->load('product')], 201);
    }

    public function updatePrestation(Request $request, Mission $mission, int $prestationId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $prestation = ClientPrestation::where('mission_id', $mission->id)->findOrFail($prestationId);
        $data = $request->validate([
            'product_id' => ['sometimes', 'nullable', 'exists:products,id'],
            'label' => ['sometimes', 'string', 'max:255'],
            'duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:0'], // C4 2026-05-22
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'billing_type' => ['sometimes', 'nullable', 'in:hourly,forfait,frais,remise,carte,exceptional'],
            'pricing_type' => ['sometimes', 'in:default,custom'],
            'custom_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'base_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'no_intervention_no_bill' => ['sometimes', 'boolean'],
            'quote_id' => ['sometimes', 'nullable', 'exists:quotes,id'],
            'nature' => ['sometimes', 'in:regular,punctual'],
            'recurrence_frequency' => ['sometimes', 'nullable', 'in:daily,weekly,monthly,yearly'],
            'recurrence_interval' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'recurrence_days_of_week' => ['sometimes', 'nullable', 'string', 'max:32'],
            // Accepte HH:MM (input time à la création) ET HH:MM:SS (heure rechargée
            // depuis la colonne `time` PostgreSQL à la modification) — sinon une
            // ré-sauvegarde de prestation récurrente renvoyait un 422 "format invalide".
            'recurrence_start_time' => ['sometimes', 'nullable', 'date_format:H:i,H:i:s'],
            'recurrence_end_time' => ['sometimes', 'nullable', 'date_format:H:i,H:i:s'],
            'recurrence_end_type' => ['sometimes', 'nullable', 'in:never,on_date,after_occurrences'],
            'recurrence_occurrences_count' => ['sometimes', 'nullable', 'integer', 'min:1'],
            // Intervenant par défaut des RDV générés (P2 — 2026-05-21).
            'default_employee_id' => ['sometimes', 'nullable', 'exists:employees,id'],
        ]);

        DB::transaction(function () use ($prestation, $data) {
            $prestation->update($data);
            // Resynchronise l'intervention récurrente modèle après modif.
            app(RecurringInterventionGenerator::class)->syncForPrestation($prestation->fresh());
        });

        return ['data' => $prestation->fresh('product')];
    }

    /**
     * Règles de validation communes pour une prestation contractualisée.
     * Le préfixe permet de réutiliser ces règles pour les sous-tableaux
     * (`prestations.*.`) du batch create de mission.
     */
    private function prestationRules(string $prefix = ''): array
    {
        $required = $prefix === '' ? 'required' : 'required_with:prestations';

        return [
            "{$prefix}product_id" => ['nullable', 'exists:products,id'],
            "{$prefix}label" => [$required, 'string', 'max:255'],
            // duration_minutes : durée standard saisie sur la prestation
            // (refonte C4 2026-05-22 — n'est plus portée par le catalogue).
            "{$prefix}duration_minutes" => ['nullable', 'integer', 'min:0'],
            "{$prefix}start_date" => ['nullable', 'date'],
            "{$prefix}end_date" => ['nullable', 'date'],
            "{$prefix}billing_type" => ['nullable', 'in:hourly,forfait,frais,remise,carte,exceptional'],
            "{$prefix}pricing_type" => ['nullable', 'in:default,custom'],
            "{$prefix}custom_price" => ['nullable', 'numeric', 'min:0'],
            "{$prefix}base_price" => ['nullable', 'numeric', 'min:0'],
            "{$prefix}no_intervention_no_bill" => ['nullable', 'boolean'],
            // Nature + récurrence (refonte 2026-05-21)
            "{$prefix}nature" => ['nullable', 'in:regular,punctual'],
            "{$prefix}recurrence_frequency" => ['nullable', 'in:daily,weekly,monthly,yearly'],
            "{$prefix}recurrence_interval" => ['nullable', 'integer', 'min:1'],
            "{$prefix}recurrence_days_of_week" => ['nullable', 'string', 'max:32'],
            // HH:MM (création) ou HH:MM:SS (heure rechargée de la colonne `time`).
            "{$prefix}recurrence_start_time" => ['nullable', 'date_format:H:i,H:i:s'],
            "{$prefix}recurrence_end_time" => ['nullable', 'date_format:H:i,H:i:s'],
            "{$prefix}recurrence_end_type" => ['nullable', 'in:never,on_date,after_occurrences'],
            "{$prefix}recurrence_occurrences_count" => ['nullable', 'integer', 'min:1'],
            // Intervenant par défaut des RDV générés (P2 — 2026-05-21).
            "{$prefix}default_employee_id" => ['nullable', 'exists:employees,id'],
        ];
    }

    /**
     * Normalise les données d'une prestation avant persistance :
     *  - auto-fill du base_price depuis le produit catalogue si tarif par défaut ;
     *  - défaut `nature = 'punctual'` si non précisée.
     */
    private function normalizePrestationData(array $p): array
    {
        $p['nature'] = $p['nature'] ?? 'punctual';

        // Auto-fill base_price depuis le produit catalogue si pricing_type=default
        if (($p['pricing_type'] ?? 'default') === 'default' && ! empty($p['product_id']) && empty($p['base_price'])) {
            $product = \App\Models\Product::find($p['product_id']);
            $p['base_price'] = $product?->price;
        }

        return $p;
    }

    public function destroyPrestation(Request $request, Mission $mission, int $prestationId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $prestation = ClientPrestation::where('mission_id', $mission->id)->findOrFail($prestationId);

        DB::transaction(function () use ($prestation) {
            // Supprime d'abord l'intervention récurrente modèle générée pour cette
            // prestation (FK restrictOnDelete sur interventions.client_prestation_id
            // → sinon le soft-delete de la prestation laisserait une récurrence
            // orpheline visible au planning).
            \App\Models\Intervention::where('client_prestation_id', $prestation->id)
                ->where('is_recurring', true)
                ->where('is_exception', false)
                ->get()
                ->each->delete();  // soft delete
            $prestation->delete();
        });

        return response()->noContent();
    }

    // ========== PRODUITS / CONSOMMABLES DE LA MISSION (avec décompte stock) ==========

    /**
     * GET /api/v1/missions/{mission}/stock-items
     * Liste les produits de stock / lignes libres rattachés à la mission.
     */
    public function listStockItems(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        return ['data' => $mission->stockItems()
            ->with('stockProduct:id,name,reference,unit,current_quantity')
            ->orderBy('id')
            ->get()];
    }

    /**
     * POST /api/v1/missions/{mission}/stock-items
     *
     * Ajoute un produit du stock (ou une ligne libre) à la mission.
     * Si `stock_product_id` est renseigné → mouvement de SORTIE immédiat
     * (décompte du stock). Ligne libre → aucun mouvement.
     *
     * Garde-fou stock insuffisant : NON bloquant (le commerce passe avant —
     * cf. StockMovementService). L'info est renvoyée dans `low_stock`.
     */
    public function storeStockItem(Request $request, Mission $mission, MissionStockService $service)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $data = $request->validate([
            'stock_product_id' => ['nullable', 'exists:stock_products,id'],
            'label' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
        ]);
        $data['unit_price'] = $data['unit_price'] ?? 0;

        $userId = $request->user()->id;

        $item = DB::transaction(fn () => $service->addItem($mission, $data, $userId));

        $item->load('stockProduct:id,name,reference,unit,current_quantity');

        return response()->json([
            'data' => $item,
            // Info non bloquante : le produit est-il maintenant sous le seuil ?
            'low_stock' => $item->stockProduct
                && $item->stockProduct->current_quantity <= ($item->stockProduct->alert_threshold ?? 0),
        ], 201);
    }

    /**
     * PATCH /api/v1/missions/{mission}/stock-items/{id}
     *
     * Modifie une ligne. Un changement de quantité (ou de produit) ajuste le
     * stock par un mouvement de la différence (cf. MissionStockService).
     */
    public function updateStockItem(Request $request, Mission $mission, int $id, MissionStockService $service)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $item = MissionStockItem::where('mission_id', $mission->id)->findOrFail($id);

        $data = $request->validate([
            'stock_product_id' => ['sometimes', 'nullable', 'exists:stock_products,id'],
            'label' => ['sometimes', 'string', 'max:255'],
            'quantity' => ['sometimes', 'numeric', 'min:0.01'],
            'unit_price' => ['sometimes', 'numeric', 'min:0'],
        ]);

        $userId = $request->user()->id;

        $item = DB::transaction(fn () => $service->updateItem($item, $data, $userId));

        $item->load('stockProduct:id,name,reference,unit,current_quantity');

        return [
            'data' => $item,
            'low_stock' => $item->stockProduct
                && $item->stockProduct->current_quantity <= ($item->stockProduct->alert_threshold ?? 0),
        ];
    }

    /**
     * DELETE /api/v1/missions/{mission}/stock-items/{id}
     *
     * Retire une ligne. Si elle référençait un produit de stock → mouvement
     * d'ENTRÉE (le stock est restitué).
     */
    public function destroyStockItem(Request $request, Mission $mission, int $id, MissionStockService $service)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $item = MissionStockItem::where('mission_id', $mission->id)->findOrFail($id);
        $userId = $request->user()->id;

        DB::transaction(fn () => $service->removeItem($item, $userId));

        return response()->noContent();
    }
}
