<?php

namespace App\Observers;

use App\Models\Intervention;
use App\Models\User;
use App\Services\NotificationDispatcher;

/**
 * Déclenche les notifications applicatives sur les events Intervention.
 *
 * Destinataires possibles d'un RDV :
 *   - l'intervenant assigné  → employee.user_id
 *   - le client              → client.portal_user_id (s'il a un accès extranet)
 *
 * Events couverts :
 *   - created            → `intervention_assigned`  : intervenant + client
 *   - update employee_id → `intervention_assigned`  : nouvel intervenant + client
 *   - update date/heure  → `intervention_modified`  : intervenant + client
 *   - status = annulee   → `intervention_cancelled` : intervenant + client
 *
 * Règle : on ne notifie JAMAIS l'auteur de l'action (cf. LRN 2026-05-19).
 * Ici l'auteur est un admin la plupart du temps ; l'intervenant et le client
 * ne sont jamais à l'origine d'un RDV, donc aucun risque d'auto-notif — mais on
 * filtre quand même via auth() par sécurité.
 */
class InterventionObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Intervention $iv): void
    {
        // RDV à pourvoir : aucun intervenant assigné → on notifie les ADMINS
        // pour qu'ils sélectionnent un intervenant. Cas typique : intervention
        // récurrente modèle générée depuis une mission (Étape 3 refonte 2026-05-21).
        if ($iv->status === 'a_pourvoir' && empty($iv->employee_id)) {
            $this->notifyAdminsUnassigned($iv);
            return;  // pas de double notif "nouveau rendez-vous" (pas d'intervenant)
        }

        $userIds = $this->recipients($iv);
        if (empty($userIds)) return;

        $this->dispatcher->dispatch(
            code: 'intervention_assigned',
            userIds: $userIds,
            title: 'Nouveau rendez-vous',
            body: $this->describe($iv),
            target: $iv,
        );
    }

    /**
     * Notifie les admins (super_admin + admin) qu'un RDV reste à pourvoir.
     * L'auteur de l'action est exclu (cf. LRN 2026-05-19).
     */
    private function notifyAdminsUnassigned(Intervention $iv): void
    {
        $adminIds = User::role(['super_admin', 'admin'])->pluck('id')->all();

        $authorId = auth()->id();
        if ($authorId) {
            $adminIds = array_filter($adminIds, fn ($id) => (int) $id !== (int) $authorId);
        }
        $adminIds = array_values(array_unique(array_map('intval', $adminIds)));
        if (empty($adminIds)) return;

        $this->dispatcher->dispatch(
            code: 'intervention_unassigned',
            userIds: $adminIds,
            title: 'RDV à pourvoir — sélectionner un intervenant',
            body: $this->describe($iv),
            target: $iv,
        );
    }

    public function updated(Intervention $iv): void
    {
        // Changement d'intervenant : notifier le NOUVEAU intervenant + le client.
        if ($iv->wasChanged('employee_id') && $iv->employee_id) {
            $userIds = $this->recipients($iv);
            if (! empty($userIds)) {
                $this->dispatcher->dispatch(
                    code: 'intervention_assigned',
                    userIds: $userIds,
                    title: 'Intervenant modifié',
                    body: $this->describe($iv),
                    target: $iv,
                );
            }
        } elseif ($iv->wasChanged(['start_datetime', 'end_datetime', 'recurrence_start_date'])) {
            // Changement de date/heure (hors réaffectation, déjà traitée ci-dessus
            // pour éviter une double notif quand les deux changent ensemble).
            $userIds = $this->recipients($iv);
            if (! empty($userIds)) {
                $this->dispatcher->dispatch(
                    code: 'intervention_modified',
                    userIds: $userIds,
                    title: 'Rendez-vous reporté',
                    body: $this->describe($iv),
                    target: $iv,
                );
            }
        }

        // Annulation
        if ($iv->wasChanged('status') && $iv->status === 'annulee') {
            $userIds = $this->recipients($iv);
            if (! empty($userIds)) {
                $this->dispatcher->dispatch(
                    code: 'intervention_cancelled',
                    userIds: $userIds,
                    title: 'Rendez-vous annulé',
                    body: $this->describe($iv),
                    target: $iv,
                );
            }
        }
    }

    /**
     * Destinataires d'une notif de RDV : intervenant assigné (compte user)
     * + client (compte extranet s'il existe). L'auteur de l'action est exclu.
     */
    private function recipients(Intervention $iv): array
    {
        $iv->loadMissing(['employee:id,user_id', 'client:id,portal_user_id']);

        $ids = [];
        if ($iv->employee?->user_id) {
            $ids[] = (int) $iv->employee->user_id;
        }
        if ($iv->client?->portal_user_id) {
            $ids[] = (int) $iv->client->portal_user_id;
        }

        // Ne jamais s'auto-notifier (cf. LRN 2026-05-19).
        $authorId = auth()->id();
        if ($authorId) {
            $ids = array_filter($ids, fn ($id) => $id !== (int) $authorId);
        }

        return array_values(array_unique($ids));
    }

    private function describe(Intervention $iv): string
    {
        $iv->loadMissing('client.company');
        $who = $iv->client?->company?->company_name
            ?? $iv->client?->code
            ?? 'client';

        // Récurrente : pas de start_datetime, on décrit la périodicité.
        if ($iv->is_recurring) {
            $freq = match ($iv->frequency) {
                'daily' => 'tous les jours',
                'weekly' => 'chaque semaine',
                'monthly' => 'chaque mois',
                'yearly' => 'chaque année',
                default => 'récurrent',
            };
            $time = $iv->start_time ? ' à ' . substr((string) $iv->start_time, 0, 5) : '';
            return "RDV récurrent ({$freq}{$time}) chez {$who}";
        }

        if (! $iv->start_datetime) return "Voir détails dans le planning ({$who}).";
        $when = $iv->start_datetime->isoFormat('dddd D MMMM, HH:mm');
        return "{$when} chez {$who}";
    }
}
