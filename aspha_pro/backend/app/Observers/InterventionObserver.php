<?php

namespace App\Observers;

use App\Models\Intervention;
use App\Services\NotificationDispatcher;

/**
 * Déclenche les notifications applicatives sur les events Intervention.
 *
 *  - Créée avec employee_id assigné → notif `intervention_assigned` à l'intervenant
 *  - Update employee_id (réaffectation) → notif `intervention_assigned` au nouveau
 *  - Annulation (status = annulee) → notif `intervention_cancelled` à l'intervenant
 */
class InterventionObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Intervention $iv): void
    {
        if (! $iv->employee_id || ! $iv->employee?->user_id) return;

        $this->dispatcher->dispatch(
            code: 'intervention_assigned',
            userIds: [$iv->employee->user_id],
            title: 'Nouvelle intervention assignée',
            body: $this->describe($iv),
            target: $iv,
        );
    }

    public function updated(Intervention $iv): void
    {
        // Changement d'intervenant
        if ($iv->wasChanged('employee_id') && $iv->employee_id) {
            $iv->loadMissing('employee');
            if ($iv->employee?->user_id) {
                $this->dispatcher->dispatch(
                    code: 'intervention_assigned',
                    userIds: [$iv->employee->user_id],
                    title: 'Intervention assignée',
                    body: $this->describe($iv),
                    target: $iv,
                );
            }
        }

        // Annulation
        if ($iv->wasChanged('status') && $iv->status === 'annulee') {
            $iv->loadMissing('employee');
            if ($iv->employee?->user_id) {
                $this->dispatcher->dispatch(
                    code: 'intervention_cancelled',
                    userIds: [$iv->employee->user_id],
                    title: 'Intervention annulée',
                    body: $this->describe($iv),
                    target: $iv,
                );
            }
        }
    }

    private function describe(Intervention $iv): string
    {
        if (! $iv->start_datetime) return 'Voir détails dans le planning.';
        $iv->loadMissing('client');
        $when = $iv->start_datetime->isoFormat('dddd D MMMM, HH:mm');
        $who = $iv->client?->code ?? 'client';
        return "{$when} chez {$who}";
    }
}
