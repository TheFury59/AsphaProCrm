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

        $ticket = ClientRequest::create($data);

        // Émettre une notification typée pour les gestionnaires.
        // On la rattache au user "assigned_to" si présent, sinon au créateur.
        $typeId = \App\Models\NotificationType::where('code', 'client_request_new')->value('id');
        if ($typeId) {
            \App\Models\Notification::create([
                'notification_type_id' => $typeId,
                'user_id' => $data['assigned_to'] ?? $request->user()->id,
                'title' => "Nouveau ticket client",
                'body' => $data['subject'] ?? "Nouveau {$data['type']}",
                'target_type' => 'client_request',
                'target_id' => $ticket->id,
                'channel' => 'push',
                'is_read' => false,
                'sent_at' => now(),
            ]);
        }

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
        ]);

        // Auto-fill resolved_at quand on passe à resolved
        if (($data['status'] ?? null) === 'resolved' && ! $clientRequest->resolved_at) {
            $data['resolved_at'] = now();
        }

        $clientRequest->update($data);
        $clientRequest->load(['client.company:id,client_id,company_name,photo,updated_at', 'assignedTo:id,name']);
        return ['data' => $clientRequest];
    }

    public function destroy(Request $request, ClientRequest $clientRequest)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
        $clientRequest->delete();
        return response()->noContent();
    }
}
