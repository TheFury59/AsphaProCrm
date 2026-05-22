<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientContract;
use Illuminate\Http\Request;

/**
 * CRUD des contrats côté CLIENT (tâche B4).
 *
 * Sous-ressource de Client : /api/v1/clients/{client}/contracts.
 * Permissions alignées sur les autres sous-ressources client
 * (`ClientSubResourceController`) : `clients.view` en lecture,
 * `clients.edit` en écriture.
 */
class ClientContractController extends Controller
{
    private function authorizeEdit(Request $request): void
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
    }

    /**
     * GET /clients/{client}/contracts — contrats du client, récents d'abord.
     */
    public function index(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        return ['data' => $client->clientContracts()->orderByDesc('created_at')->get()];
    }

    /**
     * POST /clients/{client}/contracts
     *
     * `reference` auto-générée si vide après insert, format `CTR-{id zero-pad 4}`
     * — même pattern que `ClientController::store` pour le code client.
     */
    public function store(Request $request, Client $client)
    {
        $this->authorizeEdit($request);
        $data = $this->validateContract($request);

        $contract = $client->clientContracts()->create($data);

        // Référence optionnelle : générée à partir de l'id (unique → réf
        // unique, pas de race condition). Format : CTR-0001.
        if (empty($contract->reference)) {
            $contract->update([
                'reference' => 'CTR-' . str_pad((string) $contract->id, 4, '0', STR_PAD_LEFT),
            ]);
        }

        return response()->json(['data' => $contract], 201);
    }

    /**
     * PATCH /clients/{client}/contracts/{contractId}
     */
    public function update(Request $request, Client $client, int $contractId)
    {
        $this->authorizeEdit($request);
        $contract = ClientContract::where('client_id', $client->id)
            ->where('id', $contractId)
            ->firstOrFail();

        $contract->update($this->validateContract($request, partial: true));

        return ['data' => $contract];
    }

    /**
     * DELETE /clients/{client}/contracts/{contractId}
     */
    public function destroy(Request $request, Client $client, int $contractId)
    {
        $this->authorizeEdit($request);
        ClientContract::where('client_id', $client->id)
            ->where('id', $contractId)
            ->delete();

        return response()->noContent();
    }

    /**
     * Règles de validation partagées création / mise à jour.
     * `validated()` whitelist les champs → pas d'oubli de colonne.
     */
    private function validateContract(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'nullable';

        return $request->validate([
            'reference' => [$req, 'nullable', 'string', 'max:255'],
            'type' => [$req, 'nullable', 'string', 'max:255'],
            'start_date' => [$req, 'nullable', 'date'],
            'end_date' => [$req, 'nullable', 'date'],
            'commitment_duration' => [$req, 'nullable', 'string', 'max:255'],
            'billing_rhythm' => [$req, 'nullable', 'string', 'max:255'],
            'tacit_renewal' => [$req, 'nullable', 'boolean'],
            'status' => [$req, 'nullable', 'string', 'max:64'],
            'notes' => [$req, 'nullable', 'string'],
        ]);
    }
}
