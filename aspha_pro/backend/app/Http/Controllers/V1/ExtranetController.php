<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Quote;
use App\Services\InterventionExpander;
use App\Services\QuotePdfGenerator;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Endpoints dédiés aux extranets — vues restreintes pour intervenant et client.
 *
 * Chaque endpoint vérifie que l'utilisateur courant accède bien à SES propres données :
 *  - intervenant : son planning, son contrat, ses absences, ses fiches de paie (lien Silae)
 *  - client : ses factures, ses devis, ses contrats signés, ses réassorts
 *
 * La résolution user → employee / client se fait via la FK employees.user_id
 * et clients.user_id (s'il y en a).
 */
class ExtranetController extends Controller
{
    // ========== INTERVENANT ==========

    public function intervenantProfile(Request $request)
    {
        $user = $request->user();
        $employee = Employee::with([
            'user:id,email',  // pour fallback email de connexion si pas d'email perso
            'currentContract', 'entity', 'skills', 'addresses',
        ])
            ->where('user_id', $user->id)
            ->first();
        abort_unless($employee, 404, 'Profil intervenant introuvable');
        return ['data' => $employee];
    }

    public function intervenantPlanning(Request $request, InterventionExpander $expander)
    {
        $user = $request->user();
        $employee = Employee::where('user_id', $user->id)->first();
        abort_unless($employee, 404);

        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);
        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();

        $events = $expander->expandWindow($from, $to)
            ->filter(fn ($e) => ($e['employee']['id'] ?? null) === $employee->id);

        return ['data' => $events->values()];
    }

    public function intervenantAbsences(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404);
        return ['data' => $employee->absences()->with('reason')->orderByDesc('start_date')->get()];
    }

    public function intervenantContract(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404);
        return ['data' => $employee->currentContract];
    }

    // ========== CLIENT ==========

    public function clientProfile(Request $request)
    {
        $user = $request->user();
        $client = Client::with(['company', 'addresses', 'contacts'])
            ->where('portal_user_id', $user->id)
            ->first();
        abort_unless($client, 404, 'Profil client introuvable');
        return ['data' => $client];
    }

    public function clientInvoices(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404);
        $invoices = \App\Models\Invoice::where('client_id', $client->id)
            ->orderByDesc('invoice_date')
            ->get();
        return ['data' => $invoices];
    }

    public function clientQuotes(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404);
        return ['data' => Quote::where('client_id', $client->id)
            ->with('items')
            ->orderByDesc('id')
            ->get()];
    }

    /**
     * Résout le devis demandé en garantissant qu'il appartient bien au client
     * lié au `portal_user_id` de l'utilisateur connecté.
     *
     * Garde d'ownership stricte (cf. audit sécurité 2026-05-19 — un client ne
     * doit JAMAIS accéder au devis d'un autre client). On ne s'appuie pas sur
     * le route-model-binding seul : on re-vérifie `quote.client_id` contre le
     * client résolu via `portal_user_id`.
     */
    private function resolveOwnedQuote(Request $request, Quote $quote): array
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404, 'Profil client introuvable');
        abort_unless((int) $quote->client_id === (int) $client->id, 403, 'Ce devis ne vous appartient pas.');

        return [$client, $quote];
    }

    /**
     * POST /api/v1/extranet/client/quotes/{quote}/accept
     *
     * Le client valide SON devis depuis l'extranet. Le devis doit être au
     * statut `sent` (en attente de validation). Passe le statut à `accepted`.
     *
     * La notification aux admins (« Devis validé ») est émise par
     * QuoteObserver::updated (point d'émission unique — cf. LRN 2026-05-18).
     */
    public function acceptClientQuote(Request $request, Quote $quote)
    {
        [, $quote] = $this->resolveOwnedQuote($request, $quote);

        abort_if(
            $quote->status !== 'sent',
            409,
            "Ce devis n'est pas en attente de validation.",
        );

        $quote->update(['status' => 'accepted']);

        return ['data' => $quote->fresh(['items'])];
    }

    /**
     * POST /api/v1/extranet/client/quotes/{quote}/refuse
     *
     * Symétrique de `accept` : le client refuse son devis → statut `refused`.
     */
    public function refuseClientQuote(Request $request, Quote $quote)
    {
        [, $quote] = $this->resolveOwnedQuote($request, $quote);

        abort_if(
            $quote->status !== 'sent',
            409,
            "Ce devis n'est pas en attente de validation.",
        );

        $quote->update(['status' => 'refused']);

        return ['data' => $quote->fresh(['items'])];
    }

    /**
     * GET /api/v1/extranet/client/quotes/{quote}/pdf
     *
     * Téléchargement du PDF du devis depuis l'extranet client. Réutilise le
     * `QuotePdfGenerator` (même rendu que la route admin) mais avec une garde
     * d'ownership client — on NE pointe PAS l'extranet vers `/quotes/{id}/pdf`
     * (route admin protégée par la permission `sales.quotes.view`).
     */
    public function clientQuotePdf(Request $request, Quote $quote, QuotePdfGenerator $generator)
    {
        [, $quote] = $this->resolveOwnedQuote($request, $quote);

        $pdf = $generator->generate($quote);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . ($quote->reference ?? "devis-{$quote->id}") . '.pdf"',
        ]);
    }

    public function clientPrestations(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404);
        return ['data' => $client->clientPrestations()->with('product')->get()];
    }

    /**
     * GET /api/v1/extranet/client/tickets
     * Liste les tickets du client connecté (ses propres demandes).
     */
    public function clientTickets(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404);
        $tickets = \App\Models\ClientRequest::where('client_id', $client->id)
            ->with('assignedTo:id,name')
            ->orderByDesc('created_at')
            ->get();
        return ['data' => $tickets];
    }

    /**
     * POST /api/v1/extranet/client/tickets
     * Crée un ticket depuis l'extranet client. Le client_id est forcé
     * au client lié à l'utilisateur connecté (pas de spoofing possible).
     */
    public function createClientTicket(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404);

        $data = $request->validate([
            'type' => ['required', 'in:complaint,problem_report,consumable_reorder'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
        ]);

        // La notif est émise par ClientRequestObserver::created (DRY) :
        // title = raison sociale + body = subject + target = ticket
        // → permet le deep-link côté UI admin.
        $ticket = \App\Models\ClientRequest::create([
            ...$data,
            'client_id' => $client->id,
            'status' => 'open',
            'priority' => $data['priority'] ?? 'normal',
            'created_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $ticket], 201);
    }

    // ========== INTERVENANT — TICKETS (signaler un problème client) ==========

    /**
     * GET /api/v1/extranet/intervenant/tickets
     *
     * Liste les tickets créés par l'intervenant connecté (peu importe le client).
     * Permet de suivre ses propres signalements.
     */
    public function intervenantTickets(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404);

        $tickets = \App\Models\ClientRequest::where('created_by_user_id', $request->user()->id)
            ->with([
                'client:id,code',
                'client.company:id,client_id,company_name,photo,updated_at',
            ])
            ->orderByDesc('created_at')
            ->get();

        return ['data' => $tickets];
    }

    /**
     * POST /api/v1/extranet/intervenant/tickets
     *
     * Permet à l'intervenant de signaler un problème pour un de SES clients
     * (= un client chez qui il a déjà au moins une intervention).
     * Garde-fou : on vérifie que le client_id est bien rattaché à l'intervenant
     * via au moins une intervention — pas de spoofing possible.
     */
    public function createIntervenantTicket(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404);

        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'type' => ['required', 'in:complaint,problem_report,consumable_reorder'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
        ]);

        // Sécurité : vérifier que l'intervenant a au moins une intervention chez ce client
        $hasIntervention = \App\Models\Intervention::where('employee_id', $employee->id)
            ->where('client_id', $data['client_id'])
            ->exists();

        if (! $hasIntervention) {
            return response()->json([
                'message' => "Tu ne peux signaler des problèmes que pour des clients chez qui tu interviens.",
            ], 403);
        }

        $ticket = \App\Models\ClientRequest::create([
            ...$data,
            'status' => 'open',
            'priority' => $data['priority'] ?? 'normal',
            'created_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $ticket], 201);
    }

    /**
     * GET /api/v1/extranet/intervenant/my-clients
     *
     * Liste des clients chez qui l'intervenant connecté a au moins une
     * intervention (pour peupler le sélecteur dans le formulaire ticket).
     */
    public function intervenantMyClients(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404);

        $clientIds = \App\Models\Intervention::where('employee_id', $employee->id)
            ->whereNotNull('client_id')
            ->distinct()
            ->pluck('client_id');

        $clients = \App\Models\Client::with('company:id,client_id,company_name,photo,updated_at')
            ->whereIn('id', $clientIds)
            ->get(['id', 'code']);

        return ['data' => $clients];
    }
}
