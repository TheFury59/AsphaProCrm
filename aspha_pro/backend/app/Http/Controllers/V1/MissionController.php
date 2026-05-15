<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientPrestation;
use App\Models\Mission;
use Illuminate\Http\Request;

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
            'client.company:id,client_id,company_name',
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
        ]);
        $data['status'] = $data['status'] ?? 'active';
        $mission = $client->missions()->create($data);
        return response()->json(['data' => $mission->load('clientPrestations.product')], 201);
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
            ->with(['product:id,name,code,price,default_duration_minutes', 'quote:id,reference'])
            ->orderBy('start_date')
            ->get()];
    }

    public function storePrestation(Request $request, Mission $mission)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $data = $request->validate([
            'product_id' => ['nullable', 'exists:products,id'],
            'label' => ['required', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'billing_type' => ['nullable', 'in:hourly,forfait,frais,remise,carte,exceptional'],
            'pricing_type' => ['nullable', 'in:default,custom'],
            'custom_price' => ['nullable', 'numeric', 'min:0'],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'no_intervention_no_bill' => ['nullable', 'boolean'],
            'quote_id' => ['nullable', 'exists:quotes,id'],
        ]);
        $data['mission_id'] = $mission->id;
        $data['client_id'] = $mission->client_id;

        // Auto-fill base_price depuis le produit si pricing_type=default
        if (($data['pricing_type'] ?? 'default') === 'default' && ! empty($data['product_id'])) {
            $product = \App\Models\Product::find($data['product_id']);
            $data['base_price'] = $data['base_price'] ?? $product?->price;
        }

        $prestation = ClientPrestation::create($data);
        return response()->json(['data' => $prestation->load('product')], 201);
    }

    public function updatePrestation(Request $request, Mission $mission, int $prestationId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $prestation = ClientPrestation::where('mission_id', $mission->id)->findOrFail($prestationId);
        $prestation->update($request->validate([
            'product_id' => ['sometimes', 'nullable', 'exists:products,id'],
            'label' => ['sometimes', 'string', 'max:255'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'billing_type' => ['sometimes', 'nullable', 'in:hourly,forfait,frais,remise,carte,exceptional'],
            'pricing_type' => ['sometimes', 'in:default,custom'],
            'custom_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'base_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'no_intervention_no_bill' => ['sometimes', 'boolean'],
            'quote_id' => ['sometimes', 'nullable', 'exists:quotes,id'],
        ]));
        return ['data' => $prestation->fresh('product')];
    }

    public function destroyPrestation(Request $request, Mission $mission, int $prestationId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $prestation = ClientPrestation::where('mission_id', $mission->id)->findOrFail($prestationId);
        $prestation->delete();
        return response()->noContent();
    }
}
