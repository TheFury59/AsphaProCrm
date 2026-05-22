<?php

namespace App\Console\Commands;

use App\Models\Checkin;
use App\Models\Employee;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Récap des heures travaillées pour chaque intervenant actif.
 *
 * Pour la période écoulée (semaine ou mois précédent), calcule le total des
 * durées `checkout_time - checkin_time` des pointages CLÔTURÉS de l'intervenant,
 * puis émet une notification `worked_hours_summary` via le NotificationDispatcher.
 *
 * Période :
 *   - `week`  → semaine précédente (lundi → dimanche)
 *   - `month` → mois précédent (1er → dernier jour)
 *
 * Un intervenant « actif » = Employee rattaché à un User de rôle `intervenant`
 * dont le `status` est `active`. Le dispatcher attend des user_id, pas des
 * employee_id : on émet donc vers `employee.user_id`.
 *
 * Planification (cf. routes/console.php) :
 *   - hebdo  : lundi 07:00
 *   - mensuel : le 1er du mois à 07:00
 */
class NotifyWorkedHours extends Command
{
    protected $signature = 'app:notify-worked-hours {period=week : Période à récapituler — "week" ou "month"}';

    protected $description = 'Récap des heures travaillées (hebdo/mensuel) envoyé à chaque intervenant actif';

    public function handle(NotificationDispatcher $dispatcher): int
    {
        $period = strtolower((string) $this->argument('period'));
        if (! in_array($period, ['week', 'month'], true)) {
            $this->error("Période invalide : « {$period} ». Valeurs acceptées : week, month.");
            return self::FAILURE;
        }

        // Bornes de la période écoulée.
        if ($period === 'week') {
            $start = Carbon::now()->subWeek()->startOfWeek();   // lundi 00:00
            $end = Carbon::now()->subWeek()->endOfWeek();        // dimanche 23:59
            $periodLabel = 'la semaine du ' . $start->format('d/m') . ' au ' . $end->format('d/m');
            $titleSuffix = 'cette semaine';
        } else {
            $start = Carbon::now()->subMonthNoOverflow()->startOfMonth();
            $end = Carbon::now()->subMonthNoOverflow()->endOfMonth();
            $periodLabel = 'le mois de ' . $this->frenchMonth($start);
            $titleSuffix = 'ce mois-ci';
        }

        // Intervenants actifs : Employee → User actif avec le rôle intervenant.
        $employees = Employee::query()
            ->whereNotNull('user_id')
            ->whereHas('user', function ($q) {
                $q->where('status', 'active')
                    ->whereHas('roles', fn ($r) => $r->where('name', 'intervenant'));
            })
            ->get(['id', 'user_id', 'name']);

        if ($employees->isEmpty()) {
            $this->info('Aucun intervenant actif à notifier.');
            return self::SUCCESS;
        }

        $sent = 0;
        foreach ($employees as $employee) {
            // Pointages clôturés (checkin + checkout renseignés) sur la période,
            // bornés par le checkin_time.
            $checkins = Checkin::query()
                ->where('employee_id', $employee->id)
                ->whereNotNull('checkin_time')
                ->whereNotNull('checkout_time')
                ->whereBetween('checkin_time', [$start, $end])
                ->get(['checkin_time', 'checkout_time']);

            // Somme des durées en minutes. diffInMinutes(absolute) évite tout
            // total négatif si une donnée est incohérente.
            $totalMinutes = 0;
            foreach ($checkins as $c) {
                if ($c->checkin_time && $c->checkout_time) {
                    $totalMinutes += $c->checkin_time->diffInMinutes($c->checkout_time, true);
                }
            }
            $totalMinutes = (int) round($totalMinutes);

            $hours = intdiv($totalMinutes, 60);
            $minutes = $totalMinutes % 60;
            $duration = $minutes > 0
                ? "{$hours}h{$minutes}min"
                : "{$hours}h";

            $body = $totalMinutes > 0
                ? "Vous avez travaillé {$duration} sur {$periodLabel} ({$checkins->count()} intervention(s) pointée(s))."
                : "Aucune heure pointée sur {$periodLabel}.";

            $dispatcher->dispatch(
                code: 'worked_hours_summary',
                userIds: [(int) $employee->user_id],
                title: "Vos heures travaillées {$titleSuffix}",
                body: $body,
                target: null,
            );
            $sent++;
        }

        $this->info("Récap heures travaillées ({$period}) envoyé à {$sent} intervenant(s).");
        return self::SUCCESS;
    }

    /**
     * Nom de mois en français (pas de dépendance à la locale système).
     */
    private function frenchMonth(Carbon $date): string
    {
        $months = [
            1 => 'janvier', 2 => 'février', 3 => 'mars', 4 => 'avril',
            5 => 'mai', 6 => 'juin', 7 => 'juillet', 8 => 'août',
            9 => 'septembre', 10 => 'octobre', 11 => 'novembre', 12 => 'décembre',
        ];

        return ($months[$date->month] ?? '') . ' ' . $date->year;
    }
}
