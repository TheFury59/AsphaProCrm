<?php

namespace App\Observers;

use App\Models\Client;
use App\Models\ClientRequest;
use App\Services\NotificationDispatcher;

/**
 * Observer ClientRequest — émet une notification dès qu'un ticket est créé,
 * peu importe le chemin (admin global, fiche client, extranet client, command,
 * import en masse…).
 *
 * Avant cet observer, l'émission était dupliquée dans 3 controllers et un
 * chemin sur 4 oubliait de notifier. Avec l'observer, garantie d'unicité.
 *
 *  - Crée → notif `client_request_new` au gestionnaire du dossier
 *    (client.owner_user_id), avec :
 *      title = raison sociale du client (ou code si pas de société)
 *      body  = sujet du ticket
 *      target = le ticket lui-même → permet le deep-link côté UI
 *
 * Note : la priorité du ticket peut un jour conditionner les canaux (urgent
 * → SMS), mais on s'appuie pour l'instant sur les préférences utilisateur.
 */
class ClientRequestObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(ClientRequest $ticket): void
    {
        // Récupère le client et son gestionnaire. Sans gestionnaire on n'émet pas
        // (évite les notifs orphelines). En pratique tous les clients ont un owner.
        $client = Client::with('company:id,client_id,company_name')->find($ticket->client_id);
        if (! $client) return;

        $recipientId = $ticket->assigned_to
            ?? $client->owner_user_id
            ?? auth()->id();

        if (! $recipientId) return;

        // Titre = nom commercial pour que l'admin sache de qui ça vient
        // dès le premier coup d'œil dans la cloche.
        $companyName = $client->company?->company_name
            ?? $client->display_name
            ?? "Client {$client->code}";

        $this->dispatcher->dispatch(
            code: 'client_request_new',
            userIds: [$recipientId],
            title: $companyName,
            body: $ticket->subject ?? 'Nouvelle demande',
            target: $ticket,
        );
    }
}
