<?php

namespace App\Console\Commands;

use App\Models\Intervention;
use App\Models\Notification;
use App\Models\NotificationType;
use App\Models\User;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Alerte : RDV non pointé 30 minutes après son début.
 *
 * Parcourt les interventions dont `start_datetime` est dépassé de PLUS de
 * 30 min, de statut `planifiee` ou `a_pourvoir`, et qui n'ont AUCUN pointage
 * (`Checkin`) associé. Émet une notification `checkin_late` en priorité `high`
 * à l'intervenant assigné ET aux admins (super_admin + admin).
 *
 * Anti-spam : on ne ré-émet jamais pour une intervention déjà signalée. La
 * garde vérifie l'existence d'une notification `checkin_late` dont le couple
 * (target_type, target_id) pointe sur cette intervention. Comme la 1re alerte
 * crée ces notifs avec `target = $intervention`, le run suivant la voit et
 * passe l'intervention. Une seule rafale d'alerte par RDV, donc.
 *
 * Périmètre : interventions ponctuelles réelles (non récurrentes). Les
 * récurrences génèrent leurs occurrences comme interventions filles distinctes
 * avec leur propre `start_datetime` — elles sont donc déjà couvertes. On
 * exclut explicitement les patrons récurrents (`is_recurring`), qui n'ont pas
 * de `start_datetime` exploitable.
 *
 * Planification : toutes les 10 minutes (cf. routes/console.php).
 */
class NotifyOverdueCheckins extends Command
{
    protected $signature = 'app:notify-overdue-checkins';

    protected $description = 'Alerte les RDV non pointés 30 min après leur début (intervenant + admins)';

    /** Au-delà de cette ancienneté, on cesse d'alerter (RDV oubliés/passés). */
    private const STALE_HOURS = 24;

    public function handle(NotificationDispatcher $dispatcher): int
    {
        $now = Carbon::now();
        $cutoff = $now->copy()->subMinutes(30);          // début dépassé de +30 min
        $floor = $now->copy()->subHours(self::STALE_HOURS); // borne basse anti-bruit

        // Interventions candidates : ponctuelles, à pointer, début dans la
        // fenêtre [floor, cutoff], sans aucun pointage.
        $candidates = Intervention::query()
            ->whereIn('status', ['planifiee', 'a_pourvoir'])
            ->where('is_recurring', false)
            ->whereNotNull('start_datetime')
            ->whereBetween('start_datetime', [$floor, $cutoff])
            ->whereDoesntHave('checkins')
            ->with(['employee:id,user_id'])
            ->get();

        if ($candidates->isEmpty()) {
            $this->info('Aucun RDV non pointé à signaler.');
            return self::SUCCESS;
        }

        // Type checkin_late : on récupère son id pour la garde anti-spam.
        $type = NotificationType::where('code', 'checkin_late')->first();
        if (! $type) {
            $this->warn('Type de notification "checkin_late" absent — exécute le seeder.');
            return self::SUCCESS;
        }

        // Admins notifiés sur chaque alerte (ids stables, calculés une fois).
        $adminIds = User::role(['super_admin', 'admin'])->pluck('id')->map('intval')->all();

        $alerted = 0;
        $skipped = 0;
        foreach ($candidates as $iv) {
            // Anti-spam : déjà alerté pour cette intervention ?
            $already = Notification::where('notification_type_id', $type->id)
                ->where('target_type', $iv->getMorphClass())
                ->where('target_id', $iv->id)
                ->exists();

            if ($already) {
                $skipped++;
                continue;
            }

            // Destinataires : intervenant assigné (si user lié) + admins.
            $userIds = $adminIds;
            if ($iv->employee?->user_id) {
                $userIds[] = (int) $iv->employee->user_id;
            }
            $userIds = array_values(array_unique($userIds));
            if (empty($userIds)) {
                continue;
            }

            $when = $iv->start_datetime
                ? Carbon::parse($iv->start_datetime)->format('d/m à H:i')
                : 'horaire inconnu';

            $dispatcher->dispatch(
                code: 'checkin_late',
                userIds: $userIds,
                title: 'RDV non pointé',
                body: "Le RDV du {$when} n'a toujours pas été pointé plus de 30 min après son début. Vérifie la situation.",
                target: $iv,
                priority: 'high',
            );
            $alerted++;
        }

        $this->info("RDV non pointés : {$alerted} alerte(s) émise(s), {$skipped} déjà signalé(s).");
        return self::SUCCESS;
    }
}
