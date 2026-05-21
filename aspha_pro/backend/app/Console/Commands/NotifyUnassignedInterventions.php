<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\InterventionExpander;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Récap quotidien des RDV à pourvoir sur les 7 prochains jours.
 *
 * Parcourt les occurrences (ponctuelles + récurrences expansées via
 * InterventionExpander) de la fenêtre [aujourd'hui, +7j]. Pour chaque occurrence
 * SANS intervenant assigné → on prévient les admins.
 *
 * Anti-spam : un SEUL récap groupé par jour (pas une notif par occurrence).
 * Le corps de la notif liste les dates concernées.
 *
 * Planification : quotidienne à 08:00 (cf. routes/console.php).
 * Sur Render le scheduler nécessite un déclencheur externe (Render Cron Job
 * ou ping HTTP) — à câbler côté infra, voir le commit associé.
 */
class NotifyUnassignedInterventions extends Command
{
    protected $signature = 'app:notify-unassigned-interventions';

    protected $description = 'Récap quotidien aux admins des RDV à pourvoir sur les 7 prochains jours';

    public function handle(InterventionExpander $expander, NotificationDispatcher $dispatcher): int
    {
        $from = Carbon::today()->startOfDay();
        $to = Carbon::today()->addDays(7)->endOfDay();

        // Expanse toutes les interventions chevauchant la fenêtre.
        $occurrences = $expander->expandWindow($from, $to);

        // RDV à pourvoir = pas d'intervenant ET non annulé.
        $unassigned = $occurrences->filter(function ($occ) {
            $hasEmployee = ! empty($occ['employee']['id'] ?? null);
            $cancelled = ($occ['status'] ?? null) === 'annulee';
            return ! $hasEmployee && ! $cancelled;
        })->values();

        if ($unassigned->isEmpty()) {
            $this->info('Aucun RDV à pourvoir sur les 7 prochains jours.');
            return self::SUCCESS;
        }

        // Récap groupé : liste des dates (JJ/MM) distinctes.
        $dates = $unassigned
            ->pluck('occurrence_date')
            ->filter()
            ->unique()
            ->sort()
            ->map(fn ($d) => Carbon::parse($d)->format('d/m'))
            ->values();

        $count = $unassigned->count();
        $datesLabel = $dates->take(8)->implode(', ');
        if ($dates->count() > 8) {
            $datesLabel .= '…';
        }

        $body = "{$count} RDV sans intervenant sur les 7 prochains jours — dates : {$datesLabel}. "
            . 'Affecte un intervenant depuis le planning.';

        $adminIds = User::role(['super_admin', 'admin'])->pluck('id')->map('intval')->all();
        if (empty($adminIds)) {
            $this->warn('Aucun admin à notifier.');
            return self::SUCCESS;
        }

        $dispatcher->dispatch(
            code: 'intervention_unassigned',
            userIds: $adminIds,
            title: 'RDV à pourvoir cette semaine',
            body: $body,
            target: null,
        );

        $this->info("Récap envoyé à " . count($adminIds) . " admin(s) : {$count} RDV à pourvoir.");
        return self::SUCCESS;
    }
}
