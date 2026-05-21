<?php

namespace App\Observers;

use App\Models\Client;
use App\Models\ClientRequestMessage;
use App\Services\NotificationDispatcher;
use Illuminate\Support\Facades\Log;

/**
 * Observer ClientRequestMessage — point d'émission unique pour la notification
 * "nouveau message dans un ticket", peu importe le chemin (admin, extranet
 * client, extranet intervenant).
 *
 * created → `client_request_message` : notifie TOUS les participants du
 * ticket (client propriétaire + admins + intervenants affectés + créateur),
 * SAUF l'auteur du message (`sender_id`).
 *
 * Règle dure (cf. LRN 2026-05-19) : on ne notifie JAMAIS l'auteur d'une
 * action. Si après filtrage aucun destinataire ne reste → log + skip.
 */
class ClientRequestMessageObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(ClientRequestMessage $message): void
    {
        $ticket = $message->clientRequest()
            ->with(['client.company:id,client_id,company_name', 'assignedEmployees:id,user_id'])
            ->first();

        if (! $ticket) {
            Log::warning("ClientRequestMessageObserver: ticket introuvable pour le message #{$message->id}. Notif skippée.");
            return;
        }

        // Tous les participants, moins l'auteur du message.
        $recipientIds = array_values(array_filter(
            $ticket->participantUserIds(),
            fn ($id) => $id !== (int) $message->sender_id,
        ));

        if (empty($recipientIds)) {
            Log::warning("ClientRequestMessageObserver: aucun destinataire pour le message #{$message->id} (ticket #{$ticket->id}). Notif skippée.");
            return;
        }

        $companyName = $ticket->client?->company?->company_name
            ?? ($ticket->client ? "Client {$ticket->client->code}" : 'Client');

        $this->dispatcher->dispatch(
            code: 'client_request_message',
            userIds: $recipientIds,
            title: "Nouveau message · {$companyName}",
            body: $this->excerpt($message->body),
            target: $ticket,
        );
    }

    /**
     * Coupe le corps du message pour le rendre lisible dans la cloche.
     */
    private function excerpt(?string $body): string
    {
        $body = trim((string) $body);
        if ($body === '') {
            return 'Nouveau message';
        }
        return mb_strlen($body) > 120 ? mb_substr($body, 0, 117) . '…' : $body;
    }
}
