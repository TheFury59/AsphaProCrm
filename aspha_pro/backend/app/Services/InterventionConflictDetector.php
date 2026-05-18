<?php

namespace App\Services;

use App\Models\Intervention;
use Carbon\Carbon;

/**
 * Détecte les conflits horaires entre un RDV (en projet ou existant) et les
 * autres RDV de l'intervenant le même jour.
 *
 * 3 types de conflits possibles :
 *
 *  1. OVERLAP        : 2 RDV qui se chevauchent (même intervenant, même créneau)
 *  2. TRAVEL_BEFORE  : le RDV précédent finit trop tard pour laisser le temps
 *                      du trajet jusqu'au nouveau RDV
 *  3. TRAVEL_AFTER   : le RDV suivant commence trop tôt après le nouveau
 *                      (trajet impossible à temps)
 *
 * Le calcul de temps de route s'appuie sur GoogleMapsDistanceService (qui
 * tombe sur Haversine si la clé n'est pas configurée, ~40 km/h).
 *
 * Usage :
 *   app(InterventionConflictDetector::class)->check(
 *     employeeId: 1,
 *     start: Carbon::parse('2026-05-21 10:00'),
 *     end: Carbon::parse('2026-05-21 11:00'),
 *     newClientAddress: ['latitude' => 50.66, 'longitude' => 3.09],
 *     ignoreInterventionId: null,
 *   );
 */
class InterventionConflictDetector
{
    public function __construct(
        private readonly GoogleMapsDistanceService $distance,
    ) {}

    /**
     * @return array<int,array{
     *   type: string,
     *   severity: 'error'|'warning',
     *   message: string,
     *   other_intervention_id?: int,
     *   other_client?: string,
     *   other_end?: string,
     *   other_start?: string,
     *   travel_minutes?: int,
     *   missing_minutes?: int,
     * }>
     */
    public function check(
        int $employeeId,
        Carbon $start,
        Carbon $end,
        ?array $newClientAddress,
        ?int $ignoreInterventionId = null,
    ): array {
        $conflicts = [];

        // Tous les RDV de l'intervenant le même jour (hors le RDV courant si update)
        $sameDayQuery = Intervention::query()
            ->where('employee_id', $employeeId)
            ->whereDate('start_datetime', $start->toDateString())
            ->with([
                'client:id,code',
                'client.company:id,client_id,company_name',
                'client.addresses',
                'address',
            ])
            ->orderBy('start_datetime');

        if ($ignoreInterventionId !== null) {
            $sameDayQuery->where('id', '!=', $ignoreInterventionId);
        }

        $sameDayInterventions = $sameDayQuery->get();

        // === 1. OVERLAP ===
        foreach ($sameDayInterventions as $iv) {
            $ivStart = Carbon::parse($iv->start_datetime);
            $ivEnd = Carbon::parse($iv->end_datetime);
            // Overlap si les deux intervalles se chevauchent
            if ($start->lt($ivEnd) && $end->gt($ivStart)) {
                $conflicts[] = [
                    'type' => 'overlap',
                    'severity' => 'error',
                    'message' => "L'intervenant a déjà un RDV à ce créneau ("
                        .$ivStart->format('H:i')." → ".$ivEnd->format('H:i').") "
                        ."chez ".$this->clientLabel($iv).".",
                    'other_intervention_id' => $iv->id,
                    'other_client' => $this->clientLabel($iv),
                    'other_start' => $ivStart->toIso8601String(),
                    'other_end' => $ivEnd->toIso8601String(),
                ];
            }
        }

        // === 2. TRAVEL_BEFORE : RDV précédent qui finit trop tard ===
        $previous = $sameDayInterventions
            ->filter(fn ($iv) => Carbon::parse($iv->end_datetime)->lte($start))
            ->sortByDesc('end_datetime')
            ->first();

        if ($previous && $newClientAddress) {
            $prevEnd = Carbon::parse($previous->end_datetime);
            $prevAddr = $this->extractAddress($previous);
            $travel = $this->distance->distance(
                $prevAddr['latitude'] ?? null, $prevAddr['longitude'] ?? null,
                $newClientAddress['latitude'] ?? null, $newClientAddress['longitude'] ?? null,
            );
            $travelMin = (int) ($travel['duration_minutes'] ?? 0);
            $availableMin = (int) $prevEnd->diffInMinutes($start);

            if ($travelMin > $availableMin) {
                $conflicts[] = [
                    'type' => 'travel_before',
                    'severity' => 'warning',
                    'message' => "L'intervenant termine à {$prevEnd->format('H:i')} chez "
                        .$this->clientLabel($previous)
                        .", et il faut {$travelMin} min de trajet pour arriver ici à {$start->format('H:i')}. "
                        ."Il n'y a que {$availableMin} min disponibles → ".($travelMin - $availableMin)." min de retard.",
                    'other_intervention_id' => $previous->id,
                    'other_client' => $this->clientLabel($previous),
                    'other_end' => $prevEnd->toIso8601String(),
                    'travel_minutes' => $travelMin,
                    'missing_minutes' => $travelMin - $availableMin,
                ];
            }
        }

        // === 3. TRAVEL_AFTER : RDV suivant qui commence trop tôt ===
        $next = $sameDayInterventions
            ->filter(fn ($iv) => Carbon::parse($iv->start_datetime)->gte($end))
            ->sortBy('start_datetime')
            ->first();

        if ($next && $newClientAddress) {
            $nextStart = Carbon::parse($next->start_datetime);
            $nextAddr = $this->extractAddress($next);
            $travel = $this->distance->distance(
                $newClientAddress['latitude'] ?? null, $newClientAddress['longitude'] ?? null,
                $nextAddr['latitude'] ?? null, $nextAddr['longitude'] ?? null,
            );
            $travelMin = (int) ($travel['duration_minutes'] ?? 0);
            $availableMin = (int) $end->diffInMinutes($nextStart);

            if ($travelMin > $availableMin) {
                $conflicts[] = [
                    'type' => 'travel_after',
                    'severity' => 'warning',
                    'message' => "Ce RDV termine à {$end->format('H:i')}, et il faut {$travelMin} min "
                        ."pour rejoindre ".$this->clientLabel($next)." à {$nextStart->format('H:i')}. "
                        ."Il n'y a que {$availableMin} min disponibles → ".($travelMin - $availableMin)." min de retard.",
                    'other_intervention_id' => $next->id,
                    'other_client' => $this->clientLabel($next),
                    'other_start' => $nextStart->toIso8601String(),
                    'travel_minutes' => $travelMin,
                    'missing_minutes' => $travelMin - $availableMin,
                ];
            }
        }

        return $conflicts;
    }

    /**
     * Adresse effective d'un RDV : address_id direct, sinon 1ère adresse du client.
     */
    private function extractAddress(Intervention $iv): array
    {
        if ($iv->address) {
            return [
                'latitude' => (float) $iv->address->latitude,
                'longitude' => (float) $iv->address->longitude,
            ];
        }
        $addr = $iv->client?->addresses->first();
        return [
            'latitude' => $addr ? (float) $addr->latitude : null,
            'longitude' => $addr ? (float) $addr->longitude : null,
        ];
    }

    private function clientLabel(Intervention $iv): string
    {
        return $iv->client?->company?->company_name
            ?? $iv->client?->code
            ?? 'un autre client';
    }
}
