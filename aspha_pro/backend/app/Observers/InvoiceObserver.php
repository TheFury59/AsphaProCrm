<?php

namespace App\Observers;

use App\Models\Invoice;
use App\Services\NotificationDispatcher;

/**
 * Observer Invoice — point d'émission unique.
 *
 * Event couvert :
 *  - facture émise → `invoice_issued` : le client (client.portal_user_id)
 *    s'il a un accès extranet.
 *
 * Une facture passe d'abord en `draft` (brouillon, invisible du client) puis en
 * `sent` (émise). On notifie le client UNIQUEMENT à l'émission — soit à la
 * création directe en `sent`, soit à la transition draft → sent. Pas de notif
 * sur un brouillon (le client n'a pas à le voir).
 */
class InvoiceObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Invoice $invoice): void
    {
        // Création directe d'une facture déjà émise (cas rare mais possible
        // via import / API). Les brouillons ne déclenchent rien.
        if ($invoice->status === 'sent') {
            $this->notifyClient($invoice);
        }
    }

    public function updated(Invoice $invoice): void
    {
        // Transition vers "émise".
        if ($invoice->wasChanged('status') && $invoice->status === 'sent') {
            $this->notifyClient($invoice);
        }
    }

    private function notifyClient(Invoice $invoice): void
    {
        $invoice->loadMissing('client');
        $portalUserId = $invoice->client?->portal_user_id;
        if (! $portalUserId) return;

        // Ne jamais s'auto-notifier (l'auteur est un admin en pratique).
        if (auth()->id() && (int) auth()->id() === (int) $portalUserId) return;

        $this->dispatcher->dispatch(
            code: 'invoice_issued',
            userIds: [(int) $portalUserId],
            title: 'Nouvelle facture ' . ($invoice->reference ?? ''),
            body: $invoice->total !== null
                ? 'Montant : ' . number_format((float) $invoice->total, 2, ',', ' ') . ' € TTC'
                : 'Une nouvelle facture est disponible.',
            target: $invoice,
        );
    }
}
