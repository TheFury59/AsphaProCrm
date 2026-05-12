<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\ServiceAssignment;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Recurr\Rule;
use Recurr\Transformer\ArrayTransformer;
use Recurr\Transformer\Constraint\BetweenConstraint;

/**
 * Materializes ServiceAssignment recurrences into concrete Appointment rows.
 *
 * Idempotent: re-running on the same window won't duplicate appointments.
 * Uses (service_assignment_id, scheduled_start) as the natural deduplication key.
 */
class AppointmentMaterializer
{
    /**
     * Materialize appointments for ALL active assignments within [from, to].
     *
     * @return int number of appointments created
     */
    public function materializeAll(Carbon $from, Carbon $to): int
    {
        $created = 0;
        ServiceAssignment::query()
            ->where('status', ServiceAssignment::STATUS_ACTIVE)
            ->with(['service'])
            ->chunkById(200, function ($assignments) use ($from, $to, &$created) {
                foreach ($assignments as $assignment) {
                    $created += $this->materializeOne($assignment, $from, $to);
                }
            });
        return $created;
    }

    /**
     * Materialize one assignment within [from, to].
     */
    public function materializeOne(ServiceAssignment $sa, Carbon $from, Carbon $to): int
    {
        $occurrences = $sa->isRecurring()
            ? $this->expandRecurring($sa, $from, $to)
            : $this->expandPunctual($sa, $from, $to);

        if ($occurrences->isEmpty()) {
            return 0;
        }

        $existing = Appointment::query()
            ->where('service_assignment_id', $sa->id)
            ->whereBetween('scheduled_start', [$from, $to])
            ->pluck('scheduled_start')
            ->map(fn ($d) => Carbon::parse($d)->toDateTimeString())
            ->all();

        $created = 0;
        foreach ($occurrences as $start) {
            $key = $start->toDateTimeString();
            if (in_array($key, $existing, true)) {
                continue;
            }
            $end = (clone $start)->addMinutes($sa->duration_minutes);
            Appointment::create([
                'service_assignment_id' => $sa->id,
                'employee_id' => $sa->default_employee_id,
                'client_address_id' => $sa->client_address_id,
                'scheduled_start' => $start,
                'scheduled_end' => $end,
                'status' => Appointment::STATUS_PLANNED,
                'paid_to_employee' => true,
                'invoiced_to_client' => true,
            ]);
            $created++;
        }
        return $created;
    }

    /**
     * @return Collection<int, Carbon>
     */
    private function expandPunctual(ServiceAssignment $sa, Carbon $from, Carbon $to): Collection
    {
        if (! $sa->scheduled_date || ! $sa->scheduled_time) {
            return collect();
        }
        $start = Carbon::parse($sa->scheduled_date->format('Y-m-d') . ' ' . $sa->scheduled_time);
        if ($start->lt($from) || $start->gt($to)) {
            return collect();
        }
        return collect([$start]);
    }

    /**
     * @return Collection<int, Carbon>
     */
    private function expandRecurring(ServiceAssignment $sa, Carbon $from, Carbon $to): Collection
    {
        if (! $sa->recurrence_start || ! $sa->recurrence_time || ! $sa->recurrence_rule) {
            return collect();
        }
        $startTime = $sa->recurrence_time;
        $dtStart = Carbon::parse($sa->recurrence_start->format('Y-m-d') . ' ' . $startTime);

        $rule = new Rule(
            $sa->recurrence_rule,
            $dtStart,
            null,
            $sa->recurrence_start->timezone->getName() ?: 'Europe/Paris'
        );

        if ($sa->recurrence_end) {
            $rule->setUntil(Carbon::parse($sa->recurrence_end->format('Y-m-d') . ' 23:59:59'));
        }

        $transformer = new ArrayTransformer();
        $constraint = new BetweenConstraint($from, $to, true);
        $occurrences = $transformer->transform($rule, $constraint);

        return collect($occurrences)->map(fn ($r) => Carbon::instance($r->getStart()));
    }
}
