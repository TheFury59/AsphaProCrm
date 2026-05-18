<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Employee;
use App\Services\InterventionExpander;
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
        $employee = Employee::with(['currentContract', 'entity', 'skills', 'addresses'])
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
        return ['data' => \App\Models\Quote::where('client_id', $client->id)->orderByDesc('id')->get()];
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
        ]);

        return response()->json(['data' => $ticket], 201);
    }
}
