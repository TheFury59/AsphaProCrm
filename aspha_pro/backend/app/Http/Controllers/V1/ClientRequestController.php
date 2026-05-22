<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\ClientRequest;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Tickets / demandes client (table `client_requests`).
 *
 * Types métier (cf. DBML) :
 *   - 'complaint'           : réclamation
 *   - 'problem_report'      : signalement de problème
 *   - 'consumable_reorder'  : commande de consommable
 *
 * Statuts : open → in_progress → resolved → closed
 *
 * Une notification typée est émise à la création (cf. NotificationsService — à venir).
 */
class ClientRequestController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(ClientRequest::class)
            ->allowedFilters([
                'status', 'type', 'priority', 'client_id', 'assigned_to',
                AllowedFilter::callback('search', function ($q, $v) {
                    $q->where(function ($qq) use ($v) {
                        $qq->where('subject', 'like', "%$v%")
                          ->orWhere('body', 'like', "%$v%")
                          ->orWhereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$v%"));
                    });
                }),
            ])
            ->allowedSorts(['created_at', 'priority', 'status'])
            ->defaultSort('-created_at')
            ->with([
                'client:id,code',
                'client.company:id,client_id,company_name,photo,updated_at',
                'assignedTo:id,name',
            ]);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        $clientRequest->load([
            'client:id,code',
            'client.company:id,client_id,company_name,photo,updated_at',
            'assignedTo:id,name,email',
            'createdByUser:id,name',
            'assignedEmployees:id,name,user_id,avatar_path,updated_at',
            'faultEmployee:id,name,avatar_path,updated_at',
        ]);
        return ['data' => $clientRequest];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'type' => ['required', 'in:complaint,problem_report,consumable_reorder'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'status' => ['nullable', 'in:open,in_progress,resolved,closed'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'assigned_to' => ['nullable', 'exists:users,id'],
        ]);
        $data['status'] = $data['status'] ?? 'open';
        $data['priority'] = $data['priority'] ?? 'normal';

        // La notification est émise par ClientRequestObserver::created
        // → pas de duplication ici (cf. AppServiceProvider).
        $ticket = ClientRequest::create($data);
        $ticket->load(['client.company:id,client_id,company_name,photo,updated_at', 'assignedTo:id,name']);
        return response()->json(['data' => $ticket], 201);
    }

    public function update(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $data = $request->validate([
            'type' => ['sometimes', 'in:complaint,problem_report,consumable_reorder'],
            'subject' => ['sometimes', 'nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'in:open,in_progress,resolved,closed'],
            'priority' => ['sometimes', 'nullable', 'in:low,normal,high,urgent'],
            'assigned_to' => ['sometimes', 'nullable', 'exists:users,id'],
            // Levier « faute » du système de notation : l'admin désigne (ou
            // retire en envoyant null) l'intervenant responsable du ticket.
            // `nullable` explicite — sinon `exists:` rejette null (cf. lessons).
            'fault_employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'fault_comment' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        // Auto-fill resolved_at quand on passe à resolved
        if (($data['status'] ?? null) === 'resolved' && ! $clientRequest->resolved_at) {
            $data['resolved_at'] = now();
        }

        // Cohérence : retirer la faute (fault_employee_id = null) purge aussi
        // le commentaire associé, pour ne pas laisser un commentaire orphelin.
        if (array_key_exists('fault_employee_id', $data) && $data['fault_employee_id'] === null) {
            $data['fault_comment'] = null;
        }

        $clientRequest->update($data);
        $clientRequest->load([
            'client.company:id,client_id,company_name,photo,updated_at',
            'assignedTo:id,name',
            'faultEmployee:id,name,avatar_path,updated_at',
        ]);
        return ['data' => $clientRequest];
    }

    public function destroy(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $clientRequest->delete();
        return response()->noContent();
    }

    // ====================================================================
    // Fil de discussion (admin)
    // ====================================================================

    /**
     * GET /client-requests/{clientRequest}/messages
     * Liste le fil de discussion du ticket (ordre chronologique).
     */
    public function listMessages(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $messages = $clientRequest->messages()
            ->with('sender:id,name')
            ->orderBy('created_at')
            ->get();

        return ['data' => $messages];
    }

    /**
     * POST /client-requests/{clientRequest}/messages
     * Poste un message dans le fil. L'auteur est l'admin connecté.
     * La notification aux participants est émise par
     * ClientRequestMessageObserver (point d'émission unique).
     */
    public function storeMessage(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $clientRequest->messages()->create([
            'sender_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        $message->load('sender:id,name');

        return response()->json(['data' => $message], 201);
    }

    // ====================================================================
    // Affectation d'intervenant(s) (admin)
    // ====================================================================

    /**
     * POST /client-requests/{clientRequest}/employees
     * Affecte un intervenant au ticket. Idempotent (re-affecter ne crée
     * pas de doublon — la table pivot a un unique composite).
     *
     * L'intervenant affecté est notifié (`client_request_assigned`) —
     * sauf s'il s'affecte lui-même (cf. règle "jamais d'auto-notif").
     */
    public function attachEmployee(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
        ]);

        $alreadyAssigned = $clientRequest->assignedEmployees()
            ->where('employees.id', $data['employee_id'])
            ->exists();

        if (! $alreadyAssigned) {
            $clientRequest->assignedEmployees()->attach($data['employee_id']);

            $employee = \App\Models\Employee::find($data['employee_id']);
            if ($employee?->user_id && (int) $employee->user_id !== (int) $request->user()->id) {
                $clientRequest->loadMissing('client.company:id,client_id,company_name');
                $companyName = $clientRequest->client?->company?->company_name
                    ?? ($clientRequest->client ? "Client {$clientRequest->client->code}" : 'Client');

                app(\App\Services\NotificationDispatcher::class)->dispatch(
                    code: 'client_request_assigned',
                    userIds: [(int) $employee->user_id],
                    title: "Ticket à traiter · {$companyName}",
                    body: $clientRequest->subject ?? 'Vous avez été affecté à un ticket',
                    target: $clientRequest,
                );
            }
        }

        $clientRequest->load('assignedEmployees:id,name,user_id,avatar_path,updated_at');

        return ['data' => $clientRequest->assignedEmployees];
    }

    /**
     * DELETE /client-requests/{clientRequest}/employees/{employeeId}
     * Retire un intervenant du ticket.
     */
    public function detachEmployee(Request $request, ClientRequest $clientRequest, int $employeeId)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $clientRequest->assignedEmployees()->detach($employeeId);
        $clientRequest->load('assignedEmployees:id,name,user_id,avatar_path,updated_at');

        return ['data' => $clientRequest->assignedEmployees];
    }

    /**
     * GET /employees/{employee}/client-requests
     *
     * Tickets liés à un intervenant pour l'onglet de sa fiche admin :
     * ceux où il est affecté OU qu'il a créés (via son `user_id`).
     */
    public function forEmployee(Request $request, \App\Models\Employee $employee)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $tickets = ClientRequest::query()
            ->where(function ($q) use ($employee) {
                $q->whereHas('assignedEmployees', fn ($e) => $e->where('employees.id', $employee->id));
                if ($employee->user_id) {
                    $q->orWhere('created_by_user_id', $employee->user_id);
                }
            })
            ->with([
                'client:id,code',
                'client.company:id,client_id,company_name,photo,updated_at',
                'assignedTo:id,name',
            ])
            ->orderByDesc('created_at')
            ->get();

        return ['data' => $tickets];
    }
}
