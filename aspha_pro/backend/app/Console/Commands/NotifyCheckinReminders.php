<?php

namespace App\Console\Commands;

use App\Models\Intervention;
use App\Models\Notification;
use App\Models\NotificationType;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Rappels de badgeage pour l'intervenant (4 par RDV).
 *
 * Pour chaque intervention ponctuelle (non récurrente) du jour, on émet
 * jusqu'à 4 notifications en cascade :
 *
 *   1. checkin_arrival_due   — à l'heure du début, si aucun pointage
 *   2. checkin_arrival_late  — 5 min après le début, si toujours rien
 *   3. checkin_departure_due — 5 min AVANT la fin, si checkin sans checkout
 *   4. checkin_departure_late — à l'heure de fin, si toujours pas de checkout
 *
 * Anti-spam : pour chaque (intervention, code) on vérifie l'absence d'une
 * notification déjà émise (target_type/target_id). Une notif par code par RDV
 * au maximum — la commande peut donc tourner à chaque minute sans risque.
 *
 * Périmètre : intervenant assigné uniquement (employee.user_id requis). Les
 * admins ont leur propre alerte critique +30 min via NotifyOverdueCheckins.
 * Les RDV récurrents sont exclus (pas de start_datetime/end_datetime utilisables
 * sur le patron — les occurrences matérialisées sont couvertes naturellement).
 *
 * Planification : every minute (cf. routes/console.php) pour précision ±1 min.
 */
class NotifyCheckinReminders extends Command
{
    protected $signature = 'app:notify-checkin-reminders';

    protected $description = "Émet les 4 rappels de badgeage (arrivée/départ × due/late) à l'intervenant pour les RDV du jour";

    /** Tolérance retard : on cesse d'émettre une fois passé ce délai. */
    private const STALE_HOURS = 12;

    public function handle(NotificationDispatcher $dispatcher): int
    {
        $now = Carbon::now();
        $stale = $now->copy()->subHours(self::STALE_HOURS);

        $candidates = Intervention::query()
            ->whereNotIn('status', ['annulee', 'refusee'])
            ->where('is_recurring', false)
            ->whereNotNull('start_datetime')
            ->whereNotNull('end_datetime')
            ->whereNotNull('employee_id')
            ->whereBetween('start_datetime', [$stale, $now->copy()->addMinutes(10)])
            ->with(['employee:id,user_id', 'checkins:id,intervention_id,checkin_time,checkout_time'])
            ->get();

        if ($candidates->isEmpty()) {
            $this->info('Aucun RDV éligible aux rappels.');
            return self::SUCCESS;
        }

        $codes = [
            'checkin_arrival_due',
            'checkin_arrival_late',
            'checkin_departure_due',
            'checkin_departure_late',
        ];
        $typeIds = NotificationType::whereIn('code', $codes)->pluck('id', 'code');
        foreach ($codes as $c) {
            if (! isset($typeIds[$c])) {
                $this->warn("Type de notification \"{$c}\" absent — exécute le seeder.");
                return self::SUCCESS;
            }
        }

        $emitted = 0;
        foreach ($candidates as $iv) {
            $userId = $iv->employee?->user_id;
            if (! $userId) {
                continue;
            }

            $start = Carbon::parse($iv->start_datetime);
            $end = Carbon::parse($iv->end_datetime);
            $when = $start->format('d/m à H:i');

            // Dernier pointage pour ce RDV.
            $latest = $iv->checkins->sortByDesc('checkin_time')->first();
            $hasCheckin = $latest && $latest->checkin_time;
            $hasCheckout = $latest && $latest->checkout_time;

            // === Arrivée ===
            if (! $hasCheckin) {
                if ($now->gte($start) && $this->shouldEmit($iv, 'checkin_arrival_due', $typeIds)) {
                    $dispatcher->dispatch(
                        code: 'checkin_arrival_due',
                        userIds: [(int) $userId],
                        title: 'Pense à badger ton arrivée',
                        body: "Ton RDV de {$when} a commencé. Badge ton arrivée dès que possible.",
                        target: $iv,
                        priority: 'normal',
                    );
                    $emitted++;
                }

                if ($now->gte($start->copy()->addMinutes(5)) && $this->shouldEmit($iv, 'checkin_arrival_late', $typeIds)) {
                    $dispatcher->dispatch(
                        code: 'checkin_arrival_late',
                        userIds: [(int) $userId],
                        title: 'Arrivée non badgée',
                        body: "5 minutes que ton RDV de {$when} a commencé sans badgeage. Pense à pointer ton arrivée.",
                        target: $iv,
                        priority: 'high',
                    );
                    $emitted++;
                }
            }

            // === Départ ===
            if ($hasCheckin && ! $hasCheckout) {
                if ($now->gte($end->copy()->subMinutes(5)) && $this->shouldEmit($iv, 'checkin_departure_due', $typeIds)) {
                    $dispatcher->dispatch(
                        code: 'checkin_departure_due',
                        userIds: [(int) $userId],
                        title: 'Pense à badger ton départ',
                        body: "Ton RDV se termine bientôt ({$end->format('H:i')}). N'oublie pas de badger ton départ.",
                        target: $iv,
                        priority: 'normal',
                    );
                    $emitted++;
                }

                if ($now->gte($end) && $this->shouldEmit($iv, 'checkin_departure_late', $typeIds)) {
                    $dispatcher->dispatch(
                        code: 'checkin_departure_late',
                        userIds: [(int) $userId],
                        title: 'Départ non badgé',
                        body: "Ton RDV de {$when} est terminé mais ton départ n'est pas badgé. Pointe-le dès que possible.",
                        target: $iv,
                        priority: 'high',
                    );
                    $emitted++;
                }
            }
        }

        $this->info("Rappels badgeage : {$emitted} notif(s) émise(s).");
        return self::SUCCESS;
    }

    /**
     * Anti-spam : la notif (code, target=intervention) n'a-t-elle pas déjà été émise ?
     */
    private function shouldEmit(Intervention $iv, string $code, $typeIds): bool
    {
        return ! Notification::query()
            ->where('notification_type_id', $typeIds[$code])
            ->where('target_type', $iv->getMorphClass())
            ->where('target_id', $iv->id)
            ->exists();
    }
}
