<?php

namespace App\Observers;

use App\Models\Client;
use App\Models\ClientRequest;
use App\Models\User;
use App\Services\NotificationDispatcher;
use Illuminate\Support\Facades\Log;

/**
 * Observer ClientRequest (tickets / réclamations) — point d'émission unique,
 * peu importe le chemin de création (admin global, fiche client, extranet
 * client, command, import en masse…).
 *
 * Events couverts :
 *  - created → `client_request_new` : les admins (super_admin + admin)
 *              + le gestionnaire du dossier (client.owner_user_id) s'il existe.
 *              JAMAIS l'expéditeur lui-même (created_by_user_id).
 *  - update status → `client_request_status` : le créateur du ticket
 *              (created_by_user_id), pour qu'il soit prévenu de l'avancement.
 *              JAMAIS l'auteur du changement de statut (un admin en général).
 *
 * Règle dure (cf. LRN 2026-05-19) : on ne notifie JAMAIS l'auteur d'une action.
 * Si après filtrage il ne reste aucun destinataire valide → log + skip,
 * jamais de fallback "se notifier soi-même".
 */
class ClientRequestObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(ClientRequest $ticket): void
    {
        $client = Client::with('company:id,client_id,company_name')->find($ticket->client_id);

        // Destinataires : tous les admins + le gestionnaire du dossier.
        // L'audit a relevé qu'un fallback sur l'expéditeur pouvait se produire
        // quand owner_user_id était null → ici on part TOUJOURS des admins, donc
        // un destinataire valide existe tant qu'il y a au moins un admin.
        $recipientIds = User::role(['super_admin', 'admin'])->pluck('id')->all();

        if ($client?->owner_user_id) {
            $recipientIds[] = (int) $client->owner_user_id;
        }

        // Garde-fou final : ne jamais notifier l'expéditeur du ticket.
        $recipientIds = $this->excludeAuthor($recipientIds, $ticket->created_by_user_id);

        if (empty($recipientIds)) {
            Log::warning("ClientRequestObserver: aucun destinataire pour le ticket #{$ticket->id}. Notif (création) skippée.");
            return;
        }

        $companyName = $client?->company?->company_name
            ?? ($client ? "Client {$client->code}" : 'Client');

        $this->dispatcher->dispatch(
            code: 'client_request_new',
            userIds: $recipientIds,
            title: "Nouveau ticket · {$companyName}",
            body: $ticket->subject ?? 'Nouvelle demande',
            target: $ticket,
        );
    }

    public function updated(ClientRequest $ticket): void
    {
        if (! $ticket->wasChanged('status')) return;

        // Le créateur du ticket suit l'avancement. S'il est lui-même l'auteur
        // du changement de statut (cas rare), on n'émet pas (pas d'auto-notif).
        if (! $ticket->created_by_user_id) return;

        $recipientIds = $this->excludeAuthor(
            [(int) $ticket->created_by_user_id],
            auth()->id(),
        );
        if (empty($recipientIds)) return;

        $this->dispatcher->dispatch(
            code: 'client_request_status',
            userIds: $recipientIds,
            title: 'Ticket mis à jour',
            body: 'Nouveau statut : ' . $this->statusLabel($ticket->status),
            target: $ticket,
        );
    }

    /**
     * Retire l'auteur d'une action de la liste de destinataires.
     */
    private function excludeAuthor(array $ids, $authorId): array
    {
        if (! $authorId) {
            return array_values(array_unique(array_map('intval', $ids)));
        }

        return array_values(array_unique(array_filter(
            array_map('intval', $ids),
            fn ($id) => $id !== (int) $authorId,
        )));
    }

    private function statusLabel(?string $status): string
    {
        return match ($status) {
            'open' => 'ouvert',
            'in_progress' => 'en cours',
            'resolved' => 'résolu',
            'closed' => 'clôturé',
            default => (string) $status,
        };
    }
}
