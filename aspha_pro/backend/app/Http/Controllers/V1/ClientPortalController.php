<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientRequest;
use App\Models\ConsumableReorder;
use App\Models\ElectronicSignature;
use App\Models\QualityControl;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
    // ========== RÉCLAMATIONS / SIGNALEMENTS ==========

    public function listRequests(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view') || $request->user()?->can('portal.requests.create'), 403);
        return ['data' => $client->clientRequests()->orderByDesc('id')->get()];
    }

    public function storeRequest(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('portal.requests.create') || $request->user()?->can('clients.edit'), 403);
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
        return ['data' => $client->consumableReorders()->with('stockProduct:id,name,reference')->orderByDesc('id')->get()];
    }

    public function storeReorder(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('portal.requests.create') || $request->user()?->can('clients.edit'), 403);
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
        $r = ConsumableReorder::where('client_id', $client->id)->where('id', $reorderId)->firstOrFail();
        $r->update($request->validate([
            'status' => ['sometimes', 'in:pending,approved,delivered'],
            'quantity_requested' => ['sometimes', 'integer', 'min:1'],
        ]));
        return ['data' => $r->fresh()];
    }

    // ========== ELECTRONIC SIGNATURES ==========

    public function listSignatures(Request $request, int $documentId)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => ElectronicSignature::where('document_id', $documentId)->orderByDesc('id')->get()];
    }

    /**
     * Génère un lien de signature unique (token) à envoyer au signataire.
     */
    public function requestSignature(Request $request)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $data = $request->validate([
            'document_id' => ['required', 'exists:documents,id'],
            'signer_type' => ['required', 'in:client,employee'],
            'signer_id' => ['required', 'integer'],
        ]);
        $sig = ElectronicSignature::create($data + [
            'signature_token' => Str::random(40),
            'status' => 'pending',
        ]);
        return response()->json(['data' => $sig], 201);
    }

    /**
     * POST /api/v1/portal/signatures/{token}/sign
     * Endpoint public (token uniquement) appelé depuis le portail signataire.
     */
    public function sign(Request $request, string $token)
    {
        $sig = ElectronicSignature::where('signature_token', $token)
            ->where('status', 'pending')
            ->firstOrFail();
        $sig->update([
            'signed_at' => now(),
            'ip_address' => $request->ip(),
            'status' => 'signed',
        ]);
        return ['data' => ['status' => 'signed', 'signed_at' => $sig->signed_at]];
    }

    // ========== CONTRÔLES QUALITÉ ==========

    public function listQualityControls(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->qualityControls()->with('controller:id,name')->orderByDesc('control_date')->get()];
    }

    public function storeQualityControl(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
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
