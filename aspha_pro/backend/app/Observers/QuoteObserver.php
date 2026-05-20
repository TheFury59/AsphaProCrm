<?php

namespace App\Observers;

use App\Models\Quote;
use App\Services\NotificationDispatcher;

/**
 * Observer Quote (devis) — point d'émission unique.
 *
 * Event couvert :
 *  - devis envoyé → `quote_sent` : le client (client.portal_user_id)
 *    s'il a un accès extranet.
 *
 * Comme pour les factures : un devis en `draft` reste invisible du client.
 * On notifie UNIQUEMENT à l'envoi (création directe en `sent` ou transition
 * draft → sent).
 */
class QuoteObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Quote $quote): void
    {
        if ($quote->status === 'sent') {
            $this->notifyClient($quote);
        }
    }

    public function updated(Quote $quote): void
    {
        if ($quote->wasChanged('status') && $quote->status === 'sent') {
            $this->notifyClient($quote);
        }
    }

    private function notifyClient(Quote $quote): void
    {
        $quote->loadMissing('client');
        $portalUserId = $quote->client?->portal_user_id;
        if (! $portalUserId) return;

        if (auth()->id() && (int) auth()->id() === (int) $portalUserId) return;

        $this->dispatcher->dispatch(
            code: 'quote_sent',
            userIds: [(int) $portalUserId],
            title: 'Nouveau devis ' . ($quote->reference ?? ''),
            body: $quote->total !== null
                ? 'Montant : ' . number_format((float) $quote->total, 2, ',', ' ') . ' € TTC'
                : 'Un nouveau devis vous a été envoyé.',
            target: $quote,
        );
    }
}
