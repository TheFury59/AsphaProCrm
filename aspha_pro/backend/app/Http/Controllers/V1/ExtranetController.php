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
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
            // avatar_path inclus pour le accessor Employee::avatar_url qui
            // fallback sur user.avatar_url (unification mobile + web).
            'user:id,email,avatar_path,updated_at',  // fallback email + avatar perso
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
            ->filter(fn ($e) => ($e['employee']['id'] ?? null) === $employee->id)
            // F1 — l'intervenant ne doit JAMAIS voir les prix/totaux. On retire
            // unit_price / billing_type / pricing_type du bloc prestation et on
            // purge les flags facturation/paiement (cases « Facturer / Payer »).
            // On garde le libellé de la prestation (utile pour l'intervenant).
            ->map(function ($e) {
                if (! empty($e['prestation']) && is_array($e['prestation'])) {
                    $e['prestation'] = [
                        'id' => $e['prestation']['id'] ?? null,
                        'label' => $e['prestation']['label'] ?? null,
                        'product_name' => $e['prestation']['product_name'] ?? null,
                        'default_duration_minutes' => $e['prestation']['default_duration_minutes'] ?? null,
                    ];
                }
                unset($e['bill_client'], $e['is_paid'], $e['is_billed']);

                return $e;
            });

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
        // Factures en brouillon (`draft`) non visibles du client tant que
        // l'admin ne les a pas envoyées. 2026-05-21.
        $invoices = \App\Models\Invoice::where('client_id', $client->id)
            ->where('status', '!=', 'draft')
            ->orderByDesc('invoice_date')
            ->get();
        return ['data' => $invoices];
    }

    public function clientQuotes(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404);
        // Devis en brouillon (`draft`) non visibles du client : il ne voit
        // que les devis envoyés / validés / refusés. 2026-05-21.
        return ['data' => Quote::where('client_id', $client->id)
            ->where('status', '!=', 'draft')
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

    /**
     * Résout un ticket en garantissant que l'utilisateur courant en est
     * bien participant (ownership strict — cf. audit sécurité 2026-05-19).
     *
     * Un participant côté CLIENT est : le client propriétaire (le ticket
     * appartient au client lié à `portal_user_id`). On ne s'appuie pas sur
     * le route-model-binding seul : on re-vérifie `client_id`.
     */
    private function resolveClientTicket(Request $request, \App\Models\ClientRequest $ticket): \App\Models\ClientRequest
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404, 'Profil client introuvable');
        abort_unless((int) $ticket->client_id === (int) $client->id, 403, 'Ce ticket ne vous appartient pas.');

        return $ticket;
    }

    /**
     * GET /api/v1/extranet/client/tickets/{ticket}/messages
     * Fil de discussion d'un ticket du client connecté.
     */
    public function clientTicketMessages(Request $request, \App\Models\ClientRequest $ticket)
    {
        $ticket = $this->resolveClientTicket($request, $ticket);

        return ['data' => $ticket->messages()
            ->with('sender:id,name,avatar_path,updated_at')
            ->orderBy('created_at')
            ->get()];
    }

    /**
     * POST /api/v1/extranet/client/tickets/{ticket}/messages
     * Le client répond dans le fil de SON ticket.
     * La notif aux participants est émise par ClientRequestMessageObserver.
     */
    public function postClientTicketMessage(Request $request, \App\Models\ClientRequest $ticket)
    {
        $ticket = $this->resolveClientTicket($request, $ticket);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $ticket->messages()->create([
            'sender_id' => $request->user()->id,
            'body' => $data['body'],
        ]);
        $message->load('sender:id,name,avatar_path,updated_at');

        return response()->json(['data' => $message], 201);
    }

    // ========== INTERVENANT — TICKETS (signaler un problème client) ==========

    /**
     * GET /api/v1/extranet/intervenant/tickets
     *
     * Liste les tickets où l'intervenant connecté est PARTICIPANT :
     * ceux qu'il a créés (ses signalements) OU ceux où il a été affecté
     * par un admin. Dans les deux cas il peut consulter / répondre au fil.
     */
    public function intervenantTickets(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404);

        $tickets = \App\Models\ClientRequest::query()
            ->where(function ($q) use ($request, $employee) {
                $q->where('created_by_user_id', $request->user()->id)
                  ->orWhereHas('assignedEmployees', fn ($e) => $e->where('employees.id', $employee->id));
            })
            ->with([
                'client:id,code',
                'client.company:id,client_id,company_name,photo,updated_at',
            ])
            ->orderByDesc('created_at')
            ->get();

        return ['data' => $tickets];
    }

    /**
     * Résout un ticket en garantissant que l'intervenant connecté en est
     * participant : soit il l'a créé, soit il y est affecté (ownership
     * strict — cf. audit 2026-05-19).
     */
    private function resolveIntervenantTicket(Request $request, \App\Models\ClientRequest $ticket): \App\Models\ClientRequest
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404, 'Profil intervenant introuvable');

        $isCreator = (int) $ticket->created_by_user_id === (int) $request->user()->id;
        $isAssigned = $ticket->assignedEmployees()->where('employees.id', $employee->id)->exists();

        abort_unless($isCreator || $isAssigned, 403, "Vous ne participez pas à ce ticket.");

        return $ticket;
    }

    /**
     * GET /api/v1/extranet/intervenant/tickets/{ticket}/messages
     */
    public function intervenantTicketMessages(Request $request, \App\Models\ClientRequest $ticket)
    {
        $ticket = $this->resolveIntervenantTicket($request, $ticket);

        return ['data' => $ticket->messages()
            ->with('sender:id,name,avatar_path,updated_at')
            ->orderBy('created_at')
            ->get()];
    }

    /**
     * POST /api/v1/extranet/intervenant/tickets/{ticket}/messages
     * L'intervenant répond dans le fil d'un ticket auquel il participe.
     */
    public function postIntervenantTicketMessage(Request $request, \App\Models\ClientRequest $ticket)
    {
        $ticket = $this->resolveIntervenantTicket($request, $ticket);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $ticket->messages()->create([
            'sender_id' => $request->user()->id,
            'body' => $data['body'],
        ]);
        $message->load('sender:id,name,avatar_path,updated_at');

        return response()->json(['data' => $message], 201);
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

        // Auto-affecte l'intervenant créateur au ticket — sinon il n'apparaît
        // que comme `created_by_user_id` et perd l'accès participants (notifs,
        // listings côté admin, etc.). C'est l'attendu côté UX : « je signale
        // un problème → je suis dans la boucle ».
        $ticket->assignedEmployees()->attach($employee->id);

        return response()->json(['data' => $ticket->fresh(['assignedEmployees:id'])], 201);
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

    // ========== UPLOADS SELF-SERVICE (extranet) ==========

    /**
     * POST /api/v1/extranet/intervenant/avatar
     *
     * Endpoint self-service : l'intervenant connecté peut uploader son propre
     * avatar (dérivé de Employee::where('user_id', $user->id)). Pas besoin de
     * la permission admin `employees.edit` — on borne au scope du user courant.
     *
     * Mécanique identique à MediaUploadController::uploadEmployeeAvatar :
     *   - delete de l'ancien fichier avant save → pas d'accumulation
     *   - nom fichier randomisé (anti path-traversal)
     *   - validation MIME + 2 Mo max
     */
    public function uploadIntervenantAvatar(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404, 'Profil intervenant introuvable');

        $request->validate([
            'avatar' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        if ($employee->avatar_path && Storage::disk('public')->exists($employee->avatar_path)) {
            Storage::disk('public')->delete($employee->avatar_path);
        }

        $file = $request->file('avatar');
        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension();
        $filename = "{$employee->id}_".Str::random(16).".{$ext}";
        $path = $file->storeAs('avatars', $filename, 'public');

        $employee->update(['avatar_path' => $path]);

        return ['data' => $employee->fresh()];
    }

    /**
     * DELETE /api/v1/extranet/intervenant/avatar
     */
    public function deleteIntervenantAvatar(Request $request)
    {
        $employee = Employee::where('user_id', $request->user()->id)->first();
        abort_unless($employee, 404, 'Profil intervenant introuvable');

        if ($employee->avatar_path && Storage::disk('public')->exists($employee->avatar_path)) {
            Storage::disk('public')->delete($employee->avatar_path);
        }
        $employee->update(['avatar_path' => null]);

        return response()->noContent();
    }

    /**
     * POST /api/v1/extranet/client/logo
     *
     * Endpoint self-service : le client connecté peut uploader le logo de son
     * entreprise (dérivé de Client::where('portal_user_id', $user->id)).
     */
    public function uploadClientLogo(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404, 'Profil client introuvable');

        $request->validate([
            'logo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $company = $client->company;
        if (! $company) {
            return response()->json(['message' => 'Votre entreprise n\'a pas encore de fiche.'], 422);
        }

        if ($company->photo && Storage::disk('public')->exists($company->photo)) {
            Storage::disk('public')->delete($company->photo);
        }

        $file = $request->file('logo');
        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension();
        $filename = "client_{$client->id}_".Str::random(16).".{$ext}";
        $path = $file->storeAs('logos', $filename, 'public');

        $company->update(['photo' => $path]);

        return ['data' => $company->fresh()];
    }

    /**
     * DELETE /api/v1/extranet/client/logo
     */
    public function deleteClientLogo(Request $request)
    {
        $client = Client::where('portal_user_id', $request->user()->id)->first();
        abort_unless($client, 404, 'Profil client introuvable');

        $company = $client->company;
        if (! $company) {
            return response()->noContent();
        }

        if ($company->photo && Storage::disk('public')->exists($company->photo)) {
            Storage::disk('public')->delete($company->photo);
        }
        $company->update(['photo' => null]);

        return response()->noContent();
    }
}
