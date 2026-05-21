<?php

namespace App\Observers;

use App\Models\Quote;
use App\Models\User;
use App\Services\NotificationDispatcher;

/**
 * Observer Quote (devis) — point d'émission unique.
 *
 * Events couverts :
 *  - devis envoyé (`sent`) → `quote_sent` : invite le client
 *    (client.portal_user_id) à venir valider le devis sur son extranet.
 *  - devis validé (`accepted`) → `quote_accepted` : informe les admins
 *    (super_admin + admin) et leur propose de créer la mission.
 *
 * Un devis en `draft` reste invisible du client. On notifie le client
 * UNIQUEMENT à l'envoi (création directe en `sent` ou transition draft → sent).
 *
 * Point d'émission unique (cf. LRN 2026-05-18) : que le devis passe `accepted`
 * via l'extranet client (endpoint accept) ou via l'admin, la notification part
 * d'ici et d'ici seulement.
 */
class QuoteObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Quote $quote): void
    {
        if ($quote->status === 'sent') {
            $this->notifyClientToValidate($quote);
        }
        if ($quote->status === 'accepted') {
            $this->notifyAdminsAccepted($quote);
        }
    }

    public function updated(Quote $quote): void
    {
        if (! $quote->wasChanged('status')) {
            return;
        }
        if ($quote->status === 'sent') {
            $this->notifyClientToValidate($quote);
        }
        if ($quote->status === 'accepted') {
            $this->notifyAdminsAccepted($quote);
        }
    }

    /**
     * Devis envoyé → notifie le client qu'il a un devis à valider sur son
     * extranet (deep-link cloche → page « Mes devis »).
     */
    private function notifyClientToValidate(Quote $quote): void
    {
        $quote->loadMissing('client');
        $portalUserId = $quote->client?->portal_user_id;
        if (! $portalUserId) return;

        if (auth()->id() && (int) auth()->id() === (int) $portalUserId) return;

        $this->dispatcher->dispatch(
            code: 'quote_sent',
            userIds: [(int) $portalUserId],
            title: 'Devis à valider',
            body: 'Le devis ' . ($quote->reference ?? "#{$quote->id}")
                . ' attend votre validation.',
            target: $quote,
        );
    }

    /**
     * Devis validé par le client → notifie les admins (super_admin + admin).
     * La notif propose de créer la mission à partir du devis : le deep-link
     * cloche mène à la fiche devis admin où le bouton « Créer la mission »
     * apparaît tant que le devis est `accepted`.
     */
    private function notifyAdminsAccepted(Quote $quote): void
    {
        $quote->loadMissing('client.company');
        $client = $quote->client;

        $recipientIds = User::role(['super_admin', 'admin'])->pluck('id')->all();

        // Ne jamais notifier l'auteur de l'action (cf. LRN 2026-05-19).
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
            ?? ($client ? "Client {$client->code}" : 'le client');

        $this->dispatcher->dispatch(
            code: 'quote_accepted',
            userIds: $recipientIds,
            title: 'Devis validé',
            body: 'Le devis ' . ($quote->reference ?? "#{$quote->id}")
                . " a été validé par {$clientName}. Créez la mission correspondante.",
            target: $quote,
        );
    }
}
