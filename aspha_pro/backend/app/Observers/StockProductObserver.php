<?php

namespace App\Observers;

use App\Models\StockProduct;
use App\Models\User;
use App\Services\NotificationDispatcher;

/**
 * Quand un produit passe sous son seuil d'alerte (current_quantity <= alert_threshold),
 * envoie une notif aux admins + super_admin.
 *
 * Déclenchement : seulement quand on FRANCHIT le seuil (passage de "OK" à "alerte"),
 * pas à chaque save pour éviter le spam.
 */
class StockProductObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function updated(StockProduct $p): void
    {
        if (! $p->wasChanged('current_quantity')) return;

        $previous = (int) $p->getOriginal('current_quantity');
        $current = (int) $p->current_quantity;
        $threshold = (int) $p->alert_threshold;

        $wasOk = $previous > $threshold;
        $isAlert = $current <= $threshold;

        // Notifie uniquement à la transition OK → alerte
        if (! $wasOk || ! $isAlert) return;

        $adminUserIds = User::role(['admin', 'super_admin'])->pluck('id')->all();
        if (empty($adminUserIds)) return;

        $this->dispatcher->dispatch(
            code: 'stock_alert',
            userIds: $adminUserIds,
            title: "Stock bas : {$p->name}",
            body: "Stock actuel : {$current} (seuil : {$threshold})",
            target: $p,
        );
    }
}
