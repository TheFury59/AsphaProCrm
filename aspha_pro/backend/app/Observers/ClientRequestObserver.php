<?php

namespace App\Observers;

use App\Models\Client;
use App\Models\ClientRequest;
use App\Models\User;
use App\Services\NotificationDispatcher;
use Illuminate\Support\Facades\Log;

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
 * Note : la priorité du ticket peut un jour conditionner les canaux (ex:
 * urgent → email + push systématique), mais on s'appuie pour l'instant sur
 * les préférences utilisateur.
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

        // audit 2026-05-19 — résolution des destinataires sans JAMAIS retomber sur
        // l'expéditeur (auth()->id()) : le créateur recevait sa propre notif quand
        // assigned_to et client.owner_user_id étaient null.
        // Nouvel ordre : assigned_to → owner_user_id → tous les super_admin → skip + log.
        $recipientIds = [];

        if ($ticket->assigned_to) {
            $recipientIds = [(int) $ticket->assigned_to];
        } elseif ($client->owner_user_id) {
            $recipientIds = [(int) $client->owner_user_id];
        } else {
            // Dernier recours : notifier tous les super_admin pour qu'au moins quelqu'un
            // prenne en charge. Exclut explicitement l'expéditeur du ticket (created_by_user_id)
            // pour ne jamais s'auto-notifier.
            $superAdminIds = User::role('super_admin')->pluck('id')->all();
            $recipientIds = array_values(array_filter(
                $superAdminIds,
                fn ($id) => (int) $id !== (int) ($ticket->created_by_user_id ?? 0),
            ));
            if (empty($recipientIds)) {
                Log::warning("ClientRequestObserver: aucun destinataire trouvé pour le ticket #{$ticket->id} (client_id={$ticket->client_id}). Notif skippée.");
                return;
            }
        }

        // Garde-fou final : retirer l'expéditeur dans tous les cas (au cas où assigned_to
        // ou owner_user_id pointerait sur lui).
        if ($ticket->created_by_user_id) {
            $recipientIds = array_values(array_filter(
                $recipientIds,
                fn ($id) => (int) $id !== (int) $ticket->created_by_user_id,
            ));
        }
        if (empty($recipientIds)) return;

        // Titre = nom commercial pour que l'admin sache de qui ça vient
        // dès le premier coup d'œil dans la cloche.
        $companyName = $client->company?->company_name
            ?? $client->display_name
            ?? "Client {$client->code}";

        $this->dispatcher->dispatch(
            code: 'client_request_new',
            userIds: $recipientIds,
            title: $companyName,
            body: $ticket->subject ?? 'Nouvelle demande',
            target: $ticket,
        );
    }
}
