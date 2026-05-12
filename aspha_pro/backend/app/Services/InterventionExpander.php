<?php

namespace App\Services;

use App\Models\Intervention;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Expanse les interventions récurrentes en occurrences virtuelles
 * pour alimenter le feed FullCalendar.
 *
 * Une intervention `is_recurring=true` est stockée en base comme un seul
 * enregistrement. Pour l'affichage calendrier on génère N occurrences
 * virtuelles dans la fenêtre [from, to] demandée.
 *
 * Identifiant des occurrences : "<intervention_id>-<YYYYMMDD>".
 * Permet aux exceptions futures (`is_exception=true`, `exception_date`)
 * de remplacer une occurrence précise.
 *
 * Limitations MVP :
 *  - daily, weekly, monthly, yearly supportés
 *  - days_of_week (CSV mon,tue,...) honoré pour weekly
 *  - interval honoré
 *  - end_type=never|on_date|after_occurrences honoré
 *  - exclude_holidays / exclude_school_holidays : NON implémenté (à venir)
 */
class InterventionExpander
{
    private const DAY_MAP = [
        'mon' => Carbon::MONDAY,
        'tue' => Carbon::TUESDAY,
        'wed' => Carbon::WEDNESDAY,
        'thu' => Carbon::THURSDAY,
        'fri' => Carbon::FRIDAY,
        'sat' => Carbon::SATURDAY,
        'sun' => Carbon::SUNDAY,
    ];

    /**
     * Garde-fou contre les boucles infinies si une récurrence est mal configurée.
     */
    private const MAX_OCCURRENCES = 500;

    /**
     * Expand toutes les interventions (ponctuelles + récurrentes) sur la fenêtre.
     *
     * @return Collection<int, array> Liste d'événements pour FullCalendar :
     *   [
     *     'id' => '12-20260512',    // ou '12' pour ponctuel
     *     'intervention_id' => 12,
     *     'is_occurrence' => true,  // false pour ponctuel
     *     'occurrence_date' => 'YYYY-MM-DD',
     *     'start_datetime' => 'YYYY-MM-DDTHH:MM:SS',
     *     'end_datetime' => 'YYYY-MM-DDTHH:MM:SS',
     *     ...autres champs de l'intervention
     *   ]
     */
    public function expandWindow(Carbon $from, Carbon $to, ?Collection $interventions = null): Collection
    {
        // Si aucune collection fournie, on charge tout ce qui pourrait chevaucher
        if ($interventions === null) {
            $interventions = Intervention::query()
                ->with(['employee:id,name', 'client:id,code'])
                ->where(function ($q) use ($from, $to) {
                    // Ponctuelles ET exceptions dans la fenêtre
                    $q->whereBetween('start_datetime', [$from, $to]);
                    // OU récurrentes dont la période chevauche
                    $q->orWhere(function ($q2) use ($from, $to) {
                        $q2->where('is_recurring', true)
                           ->where('is_exception', false)
                           ->where(function ($q3) use ($to) {
                               $q3->whereNull('recurrence_start_date')
                                  ->orWhere('recurrence_start_date', '<=', $to);
                           })
                           ->where(function ($q3) use ($from) {
                               $q3->whereNull('recurrence_end_date')
                                  ->orWhere('recurrence_end_date', '>=', $from);
                           });
                    });
                })
                ->get();
        }

        // Indexer les exceptions par (parent_id, exception_date) pour skip rapide.
        // exception_date est cast en Carbon → toDateString() pour avoir YYYY-MM-DD propre.
        $exceptions = $interventions
            ->where('is_exception', true)
            ->keyBy(fn ($e) => "{$e->parent_id}|" . Carbon::parse($e->exception_date)->toDateString());

        $events = collect();

        foreach ($interventions as $iv) {
            // Les exceptions sont affichées comme événements ponctuels (start_datetime/end_datetime)
            if ($iv->is_exception) {
                if ($iv->start_datetime && $iv->end_datetime) {
                    $events->push($this->serializeOccurrence($iv, $iv->start_datetime, $iv->end_datetime, false, true));
                }
                continue;
            }

            if (! $iv->is_recurring) {
                if ($iv->start_datetime && $iv->end_datetime) {
                    $events->push($this->serializeOccurrence($iv, $iv->start_datetime, $iv->end_datetime, false));
                }
                continue;
            }

            // Récurrente : générer les occurrences en skippant celles qui ont une exception
            foreach ($this->generateOccurrences($iv, $from, $to) as $occ) {
                $key = "{$iv->id}|{$occ['occurrence_date']}";
                if ($exceptions->has($key)) {
                    continue;  // l'exception remplace cette occurrence
                }
                $events->push($occ);
            }
        }

        return $events->sortBy('start_datetime')->values();
    }

    /**
     * Génère les occurrences d'une intervention récurrente dans [from, to].
     */
    private function generateOccurrences(Intervention $iv, Carbon $from, Carbon $to): array
    {
        if (! $iv->recurrence_start_date || ! $iv->frequency) {
            return [];
        }

        $startDate = CarbonImmutable::parse($iv->recurrence_start_date)->startOfDay();
        $startTime = $iv->start_time ?: '09:00:00';
        $endTime = $iv->end_time ?: '17:00:00';
        $interval = max(1, (int) ($iv->interval ?? 1));

        // Fin de récurrence
        $endDate = match ($iv->end_type) {
            'on_date' => $iv->recurrence_end_date ? CarbonImmutable::parse($iv->recurrence_end_date)->endOfDay() : null,
            'after_occurrences' => null,  // calculé via count
            default => null,  // never
        };

        $occurrencesCount = $iv->end_type === 'after_occurrences' ? (int) ($iv->occurrences_count ?? 1) : null;

        // Days of week (weekly only)
        $daysOfWeek = $this->parseDaysOfWeek($iv->days_of_week);

        $occurrences = [];
        $cursor = $startDate;
        $generated = 0;

        // Cap absolu pour éviter les boucles infinies
        $absoluteEnd = $to->copy()->addYear();

        while ($cursor->lessThanOrEqualTo($absoluteEnd) && $generated < self::MAX_OCCURRENCES) {
            // Si l'occurrence sort de la fenêtre cible par le bas, on continue
            if ($cursor->lessThan($from->copy()->startOfDay())) {
                $cursor = $this->advance($cursor, $iv->frequency, $interval, $daysOfWeek);
                if ($cursor === null) break;
                continue;
            }

            // Si l'occurrence dépasse la fin de la fenêtre, on s'arrête
            if ($cursor->greaterThan($to)) {
                break;
            }

            // Si endDate atteint, stop
            if ($endDate !== null && $cursor->greaterThan($endDate)) {
                break;
            }

            // Pour weekly, vérifier le jour de semaine
            if ($iv->frequency === 'weekly' && ! empty($daysOfWeek)) {
                if (! in_array($cursor->dayOfWeek, $daysOfWeek, true)) {
                    $cursor = $cursor->addDay();
                    continue;
                }
            }

            // Construire l'occurrence
            $start = $cursor->setTimeFromTimeString($startTime);
            $end = $cursor->setTimeFromTimeString($endTime);
            $occurrences[] = $this->serializeOccurrence($iv, $start, $end, true);
            $generated++;

            // Vérif count
            if ($occurrencesCount !== null && $generated >= $occurrencesCount) {
                break;
            }

            // Avancer le cursor
            $next = $this->advance($cursor, $iv->frequency, $interval, $daysOfWeek);
            if ($next === null) break;
            $cursor = $next;
        }

        return $occurrences;
    }

    /**
     * Avance le cursor à la prochaine occurrence potentielle.
     */
    private function advance(CarbonImmutable $cursor, string $frequency, int $interval, array $daysOfWeek): ?CarbonImmutable
    {
        switch ($frequency) {
            case 'daily':
                return $cursor->addDays($interval);
            case 'weekly':
                // Si on a des days_of_week, on avance d'un jour pour parcourir
                // chaque jour de la semaine, sauf si on est dimanche et qu'on
                // doit sauter à la semaine suivante (interval > 1).
                if (! empty($daysOfWeek)) {
                    $next = $cursor->addDay();
                    // Si interval > 1 et on dépasse dimanche, sauter (interval-1)*7 jours
                    if ($interval > 1 && $cursor->dayOfWeek === Carbon::SUNDAY) {
                        $next = $next->addDays(($interval - 1) * 7);
                    }
                    return $next;
                }
                return $cursor->addWeeks($interval);
            case 'monthly':
                return $cursor->addMonths($interval);
            case 'yearly':
                return $cursor->addYears($interval);
            default:
                return null;
        }
    }

    private function parseDaysOfWeek(?string $csv): array
    {
        if (! $csv) return [];
        $days = [];
        foreach (explode(',', $csv) as $code) {
            $code = strtolower(trim($code));
            if (isset(self::DAY_MAP[$code])) {
                $days[] = self::DAY_MAP[$code];
            }
        }
        return $days;
    }

    private function serializeOccurrence(Intervention $iv, $start, $end, bool $isOccurrence, bool $isException = false): array
    {
        $startC = $start instanceof CarbonImmutable ? $start : Carbon::parse($start);
        $endC = $end instanceof CarbonImmutable ? $end : Carbon::parse($end);
        $dateKey = $startC->format('Ymd');

        return [
            'id' => $isOccurrence ? "{$iv->id}-{$dateKey}" : (string) $iv->id,
            'intervention_id' => $iv->id,
            'parent_id' => $iv->parent_id,
            'is_occurrence' => $isOccurrence,
            'is_exception' => $isException,
            'is_recurring' => (bool) $iv->is_recurring,
            'occurrence_date' => $startC->toDateString(),
            'start_datetime' => $startC->toIso8601String(),
            'end_datetime' => $endC->toIso8601String(),
            'status' => $iv->status,
            'client' => $iv->relationLoaded('client') && $iv->client ? [
                'id' => $iv->client->id,
                'code' => $iv->client->code,
            ] : null,
            'employee' => $iv->relationLoaded('employee') && $iv->employee ? [
                'id' => $iv->employee->id,
                'name' => $iv->employee->name,
            ] : null,
            'replacement_employee_id' => $iv->replacement_employee_id,
            'comment' => $iv->comment,
            'transport_mode' => $iv->transport_mode,
            'vehicle_type' => $iv->vehicle_type,
            'frequency' => $iv->frequency,
            'days_of_week' => $iv->days_of_week,
        ];
    }
}
