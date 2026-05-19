<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientRequest;
use App\Models\ConsumableReorder;
use App\Models\QualityControl;
use Illuminate\Http\Request;

/**
 * Portail client — endpoints lus/écrits depuis l'extranet du client final ET
 * depuis l'admin pour la gestion.
 *
 *   - ClientRequest    : réclamations & signalements
 *   - ConsumableReorder: demandes de réassort consommables
 *   - ElectronicSignature : signature électronique de devis/contrats/factures
 *   - QualityControl   : contrôles qualité Aspha sur les prestations
 */
class ClientPortalController extends Controller
{
    /**
     * Garantit que le client portal user ne peut agir QUE sur SON client.
     * Les admins/super_admin ont accès à n'importe quel client (ils gèrent
     * en back-office).
     *
     * Sans cette garde, un client extranet (rôle `client`) pouvait passer
     * `clients/{otherId}/portal/...` et voir les réclamations d'un autre
     * client. Cf. audit 2026-05-19 (CRIT).
     */
    private function ensureClientOwnership(Request $request, Client $client): void
    {
        $user = $request->user();
        abort_unless($user, 401);

        if ($user->hasRole('super_admin') || $user->hasRole('admin')) {
            return;
        }

        // Pour le rôle `client` : vérifier qu'il EST le portal_user du client cible
        if ($client->portal_user_id !== $user->id) {
            abort(403, "Accès interdit à ce client.");
        }
    }

    // ========== RÉCLAMATIONS / SIGNALEMENTS ==========

    public function listRequests(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view') || $request->user()?->can('portal.requests.create'), 403);
        $this->ensureClientOwnership($request, $client);
        return ['data' => $client->clientRequests()->orderByDesc('id')->get()];
    }

    public function storeRequest(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('portal.requests.create') || $request->user()?->can('clients.edit'), 403);
        $this->ensureClientOwnership($request, $client);
        $data = $request->validate([
            'type' => ['required', 'in:complaint,problem_report,consumable_reorder'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
        ]);
        // La notif est émise par ClientRequestObserver::created (DRY).
        $req = $client->clientRequests()->create($data + [
            'status' => 'open',
            'priority' => $data['priority'] ?? 'normal',
        ]);

        return response()->json(['data' => $req], 201);
    }

    public function updateRequest(Request $request, Client $client, int $requestId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $this->ensureClientOwnership($request, $client);
        $r = ClientRequest::where('client_id', $client->id)->where('id', $requestId)->firstOrFail();
        $r->update($request->validate([
            'status' => ['sometimes', 'in:open,in_progress,resolved,closed'],
            'priority' => ['sometimes', 'in:low,normal,high,urgent'],
            'assigned_to' => ['sometimes', 'nullable', 'exists:users,id'],
            'resolved_at' => ['sometimes', 'nullable', 'date'],
        ]));
        return ['data' => $r->fresh()];
    }

    // ========== CONSUMABLE REORDERS ==========

    public function listReorders(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view') || $request->user()?->can('portal.requests.create'), 403);
        $this->ensureClientOwnership($request, $client);
        return ['data' => $client->consumableReorders()->with('stockProduct:id,name,reference')->orderByDesc('id')->get()];
    }

    public function storeReorder(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('portal.requests.create') || $request->user()?->can('clients.edit'), 403);
        $this->ensureClientOwnership($request, $client);
        $data = $request->validate([
            'stock_product_id' => ['required', 'exists:stock_products,id'],
            'quantity_requested' => ['required', 'integer', 'min:1'],
            'comment' => ['nullable', 'string'],
        ]);
        $reorder = $client->consumableReorders()->create($data + ['status' => 'pending']);
        return response()->json(['data' => $reorder->load('stockProduct:id,name,reference')], 201);
    }

    public function updateReorder(Request $request, Client $client, int $reorderId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $this->ensureClientOwnership($request, $client);
        $r = ConsumableReorder::where('client_id', $client->id)->where('id', $reorderId)->firstOrFail();
        $r->update($request->validate([
            'status' => ['sometimes', 'in:pending,approved,delivered'],
            'quantity_requested' => ['sometimes', 'integer', 'min:1'],
        ]));
        return ['data' => $r->fresh()];
    }

    // Signatures électroniques retirées le 2026-05-18 : Pennylane gère les
    // signatures côté devis/factures, pas besoin d'un module séparé. La table
    // `electronic_signatures` reste en BDD (non utilisée) pour rollback safe.

    // ========== CONTRÔLES QUALITÉ ==========

    public function listQualityControls(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        $this->ensureClientOwnership($request, $client);
        return ['data' => $client->qualityControls()->with('controller:id,name')->orderByDesc('control_date')->get()];
    }

    public function storeQualityControl(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $this->ensureClientOwnership($request, $client);
        $data = $request->validate([
            'control_date' => ['required', 'date'],
            'result' => ['required', 'in:satisfactory,needs_improvement,unsatisfactory'],
            'comment' => ['nullable', 'string'],
            'next_control_date' => ['nullable', 'date'],
        ]);
        $qc = $client->qualityControls()->create($data + [
            'controlled_by' => $request->user()->id,
        ]);
        return response()->json(['data' => $qc], 201);
    }
}
