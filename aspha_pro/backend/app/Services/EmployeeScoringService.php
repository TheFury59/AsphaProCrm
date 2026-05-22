<?php

namespace App\Services;

use App\Models\Checkin;
use App\Models\ClientRequest;
use App\Models\Employee;
use App\Models\EmployeeAbsence;
use App\Models\Intervention;
use Carbon\Carbon;

/**
 * Système de notation des intervenants (greenfield — 2026-05-22).
 *
 * Calcule une note 0-100 par intervenant sur 4 critères, à partir des
 * données réelles déjà présentes en base — AUCUNE table de notation
 * dédiée n'est créée : la note est dérivée à la volée.
 *
 *   - absences  : nombre + justification des absences sur la période
 *   - assiduite : ponctualité au pointage (retard moyen en minutes)
 *   - badgeage  : taux d'interventions passées effectivement badgées
 *   - relation  : tickets où l'intervenant a été désigné fautif par l'admin
 *
 * PRINCIPE : chaque critère part de 100 et on retranche. La note globale
 * est la moyenne pondérée des 4 critères.
 *
 * CAS « AUCUNE DONNÉE » : un intervenant sans intervention passée ne peut
 * être ni assidu ni badgeur — on renvoie alors une note NEUTRE de 100
 * (pas 0 punitif : l'absence de données n'est pas une faute). De même un
 * intervenant sans aucune absence et sans ticket fautif obtient 100 sur
 * ces critères (comportement attendu : rien à reprocher).
 */
class EmployeeScoringService
{
    /**
     * Fenêtre d'observation par défaut, en jours (90 = ~1 trimestre).
     */
    public const DEFAULT_PERIOD_DAYS = 90;

    // === Pondération de la note globale ========================================
    // 25 % chacun : choix volontairement neutre et explicable. Les 4 critères
    // ont un poids identique car ils mesurent des dimensions distinctes mais
    // également importantes du sérieux d'un intervenant. Ajustable ici.
    public const WEIGHT_ABSENCES = 0.25;
    public const WEIGHT_ASSIDUITE = 0.25;
    public const WEIGHT_BADGEAGE = 0.25;
    public const WEIGHT_RELATION = 0.25;

    // === Absences ==============================================================
    // Points retranchés par absence sur la période, selon la justification.
    public const PENALTY_ABSENCE_UNJUSTIFIED = 25; // non justifiée / refusée
    public const PENALTY_ABSENCE_JUSTIFIED = 8;    // justifiée (pèse moins)

    // === Assiduité (ponctualité) ===============================================
    // Points retranchés par minute de retard moyen au pointage.
    public const PENALTY_PER_LATE_MINUTE = 2.0;
    // Tolérance : un retard <= ce seuil (minutes) n'est pas compté comme retard.
    public const LATE_TOLERANCE_MINUTES = 0;

    // === Relation ==============================================================
    // Points retranchés par ticket où l'intervenant est désigné fautif.
    public const PENALTY_PER_FAULT_TICKET = 20;

    /**
     * Calcule la note complète d'un intervenant.
     *
     * @param  Employee     $employee  L'intervenant à noter.
     * @param  Carbon|null  $since     Début de la période. Défaut : il y a 90 jours.
     * @return array{
     *     global:int,
     *     criteria:array{absences:int,assiduite:int,badgeage:int,relation:int},
     *     details:array<string,mixed>,
     *     period:array{since:string,until:string,days:int}
     * }
     */
    public function computeScore(Employee $employee, ?Carbon $since = null): array
    {
        $until = Carbon::now();
        $since = $since ?? $until->copy()->subDays(self::DEFAULT_PERIOD_DAYS);

        $absences = $this->scoreAbsences($employee, $since, $until);
        $assiduite = $this->scoreAssiduite($employee, $since, $until);
        $badgeage = $this->scoreBadgeage($employee, $since, $until);
        $relation = $this->scoreRelation($employee, $since, $until);

        $global = (int) round(
            $absences['score'] * self::WEIGHT_ABSENCES
            + $assiduite['score'] * self::WEIGHT_ASSIDUITE
            + $badgeage['score'] * self::WEIGHT_BADGEAGE
            + $relation['score'] * self::WEIGHT_RELATION
        );

        return [
            'global' => $this->clamp($global),
            'criteria' => [
                'absences' => $absences['score'],
                'assiduite' => $assiduite['score'],
                'badgeage' => $badgeage['score'],
                'relation' => $relation['score'],
            ],
            'details' => [
                'absences' => $absences['detail'],
                'assiduite' => $assiduite['detail'],
                'badgeage' => $badgeage['detail'],
                'relation' => $relation['detail'],
            ],
            'period' => [
                'since' => $since->toDateString(),
                'until' => $until->toDateString(),
                'days' => (int) $since->diffInDays($until),
            ],
        ];
    }

    /**
     * Critère ABSENCES — 100 moins une pénalité par absence sur la période.
     * Une absence non justifiée pèse plus lourd qu'une absence justifiée.
     *
     * @return array{score:int,detail:array<string,mixed>}
     */
    private function scoreAbsences(Employee $employee, Carbon $since, Carbon $until): array
    {
        $absences = EmployeeAbsence::query()
            ->where('employee_id', $employee->id)
            ->whereNotNull('start_datetime')
            ->whereBetween('start_datetime', [$since, $until])
            ->get(['justification_status']);

        $justified = 0;
        $unjustified = 0;
        foreach ($absences as $absence) {
            // `justified` = justifiée ; tout le reste (pending, unjustified,
            // null) est traité comme non justifié → pénalité plus lourde.
            if ($absence->justification_status === 'justified') {
                $justified++;
            } else {
                $unjustified++;
            }
        }

        $penalty = $justified * self::PENALTY_ABSENCE_JUSTIFIED
            + $unjustified * self::PENALTY_ABSENCE_UNJUSTIFIED;

        $score = $this->clamp(100 - (int) round($penalty));

        return [
            'score' => $score,
            'detail' => [
                'label' => 'Absences',
                'total' => $justified + $unjustified,
                'justified' => $justified,
                'unjustified' => $unjustified,
                'summary' => ($justified + $unjustified) === 0
                    ? 'Aucune absence sur la période'
                    : sprintf(
                        '%d absence(s) — %d justifiée(s), %d non justifiée(s)',
                        $justified + $unjustified,
                        $justified,
                        $unjustified
                    ),
            ],
        ];
    }

    /**
     * Critère ASSIDUITÉ — ponctualité au pointage.
     *
     * Pour chaque checkin lié à une intervention de l'intervenant sur la
     * période, on mesure le retard = checkin_time − start_datetime de
     * l'intervention. Seuls les retards positifs (> tolérance) comptent ;
     * arriver en avance ne donne pas de bonus. Le score retranche
     * ~2 pts par minute de retard MOYEN.
     *
     * Aucun pointage exploitable → score neutre 100 (cas « aucune donnée »).
     *
     * @return array{score:int,detail:array<string,mixed>}
     */
    private function scoreAssiduite(Employee $employee, Carbon $since, Carbon $until): array
    {
        $checkins = Checkin::query()
            ->where('employee_id', $employee->id)
            ->whereNotNull('checkin_time')
            ->whereBetween('checkin_time', [$since, $until])
            ->whereHas('intervention', fn ($q) => $q->whereNotNull('start_datetime'))
            ->with('intervention:id,start_datetime')
            ->get();

        $lateMinutesSum = 0.0;
        $lateCount = 0;
        $consideredCount = 0;

        foreach ($checkins as $checkin) {
            $scheduled = $checkin->intervention?->start_datetime;
            if (! $scheduled || ! $checkin->checkin_time) {
                continue;
            }
            $consideredCount++;
            // Retard en minutes : positif si le pointage est après l'heure
            // prévue. diffInMinutes(false) garde le signe.
            $lateMinutes = $scheduled->diffInMinutes($checkin->checkin_time, false);
            if ($lateMinutes > self::LATE_TOLERANCE_MINUTES) {
                $lateMinutesSum += $lateMinutes;
                $lateCount++;
            }
        }

        if ($consideredCount === 0) {
            // Aucun pointage à évaluer → on ne punit pas : score neutre.
            return [
                'score' => 100,
                'detail' => [
                    'label' => 'Assiduité (ponctualité)',
                    'checkins_considered' => 0,
                    'late_count' => 0,
                    'avg_late_minutes' => 0,
                    'neutral' => true,
                    'summary' => 'Aucun pointage sur la période — note neutre',
                ],
            ];
        }

        // Retard moyen calculé sur l'ensemble des pointages considérés
        // (un pointage à l'heure compte comme 0 minute de retard).
        $avgLate = $lateMinutesSum / $consideredCount;
        $score = $this->clamp(100 - (int) round($avgLate * self::PENALTY_PER_LATE_MINUTE));

        return [
            'score' => $score,
            'detail' => [
                'label' => 'Assiduité (ponctualité)',
                'checkins_considered' => $consideredCount,
                'late_count' => $lateCount,
                'avg_late_minutes' => round($avgLate, 1),
                'neutral' => false,
                'summary' => sprintf(
                    '%d retard(s) sur %d pointage(s) — retard moyen %s min',
                    $lateCount,
                    $consideredCount,
                    round($avgLate, 1)
                ),
            ],
        ];
    }

    /**
     * Critère BADGEAGE — taux d'interventions PASSÉES effectivement badgées.
     *
     * On considère les interventions de l'intervenant sur la période qui
     * sont « passées » : statut `realisee` OU date de début déjà écoulée
     * (hors interventions annulées / brouillons). Le score = pourcentage
     * de celles qui ont au moins un Checkin lié.
     *
     * Aucune intervention passée → score neutre 100 (cas « aucune donnée »).
     *
     * @return array{score:int,detail:array<string,mixed>}
     */
    private function scoreBadgeage(Employee $employee, Carbon $since, Carbon $until): array
    {
        $interventions = Intervention::query()
            ->where('employee_id', $employee->id)
            ->whereNotNull('start_datetime')
            ->whereBetween('start_datetime', [$since, $until])
            ->whereNotIn('status', ['annulee', 'draft'])
            ->where(function ($q) use ($until) {
                // « Passée » = soit marquée réalisée, soit date déjà écoulée.
                $q->where('status', 'realisee')
                  ->orWhere('start_datetime', '<', $until);
            })
            ->withCount('checkins')
            ->get(['id', 'status', 'start_datetime']);

        $total = $interventions->count();

        if ($total === 0) {
            return [
                'score' => 100,
                'detail' => [
                    'label' => 'Badgeage',
                    'past_interventions' => 0,
                    'badged' => 0,
                    'badged_rate' => 0,
                    'neutral' => true,
                    'summary' => 'Aucune intervention passée sur la période — note neutre',
                ],
            ];
        }

        $badged = $interventions->filter(fn ($iv) => $iv->checkins_count > 0)->count();
        $rate = $badged / $total; // 0..1
        $score = $this->clamp((int) round($rate * 100));

        return [
            'score' => $score,
            'detail' => [
                'label' => 'Badgeage',
                'past_interventions' => $total,
                'badged' => $badged,
                'badged_rate' => (int) round($rate * 100),
                'neutral' => false,
                'summary' => sprintf(
                    '%d/%d intervention(s) badgée(s) — %d%%',
                    $badged,
                    $total,
                    (int) round($rate * 100)
                ),
            ],
        ];
    }

    /**
     * Critère RELATION — influencé par les tickets où l'admin a désigné
     * l'intervenant comme fautif (`client_requests.fault_employee_id`).
     *
     * 100 moins une pénalité fixe par ticket fautif sur la période. Aucun
     * ticket fautif → 100 (rien à reprocher).
     *
     * @return array{score:int,detail:array<string,mixed>}
     */
    private function scoreRelation(Employee $employee, Carbon $since, Carbon $until): array
    {
        $faultTickets = ClientRequest::query()
            ->where('fault_employee_id', $employee->id)
            ->whereBetween('created_at', [$since, $until])
            ->count();

        $score = $this->clamp(100 - $faultTickets * self::PENALTY_PER_FAULT_TICKET);

        return [
            'score' => $score,
            'detail' => [
                'label' => 'Relation',
                'fault_tickets' => $faultTickets,
                'summary' => $faultTickets === 0
                    ? 'Aucun ticket avec faute imputée sur la période'
                    : sprintf('%d ticket(s) avec faute imputée', $faultTickets),
            ],
        ];
    }

    /**
     * Borne une note dans l'intervalle 0-100.
     */
    private function clamp(int $value): int
    {
        return max(0, min(100, $value));
    }
}
