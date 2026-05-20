<?php

namespace App\Observers;

use App\Models\Mission;
use App\Models\User;
use App\Services\NotificationDispatcher;

/**
 * Observer Mission (contrats clients) — point d'émission unique.
 *
 * Event couvert :
 *  - created → `mission_created` : les admins (super_admin + admin)
 *              + le client (client.portal_user_id) s'il a un accès extranet.
 *
 * L'auteur de l'action (un admin en général) est exclu pour ne pas s'auto-notifier
 * (cf. LRN 2026-05-19).
 */
class MissionObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Mission $mission): void
    {
        $mission->loadMissing('client.company');
        $client = $mission->client;

        $recipientIds = User::role(['super_admin', 'admin'])->pluck('id')->all();

        if ($client?->portal_user_id) {
            $recipientIds[] = (int) $client->portal_user_id;
        }

        // Ne jamais notifier l'auteur de la création.
        $authorId = auth()->id();
        if ($authorId) {
            $recipientIds = array_filter(
                $recipientIds,
                fn ($id) => (int) $id !== (int) $authorId,
            );
        }
        $recipientIds = array_values(array_unique(array_map('intval', $recipientIds)));
        if (empty($recipientIds)) return;

        $clientName = $client?->company?->company_name
            ?? ($client ? "Client {$client->code}" : 'client');

        $this->dispatcher->dispatch(
            code: 'mission_created',
            userIds: $recipientIds,
            title: 'Nouvelle mission',
            body: ($mission->name ?? 'Mission') . " · {$clientName}",
            target: $mission,
        );
    }
}
