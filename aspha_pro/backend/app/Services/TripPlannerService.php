<?php

namespace App\Services;

use App\Models\AppSetting;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Calcule, pour un intervenant et une fenêtre, les trajets entre RDV consécutifs.
 *
 * Règle métier "45 min de pause max" :
 *  - Si gap (fin RDV N → début RDV N+1) ≤ paid_travel_max_minutes (défaut 45 min)
 *    → trajet PAYÉ à l'intervenant (durée + distance comptés dans la paie)
 *  - Sinon → trajet NON PAYÉ (pause prolongée, pas de paiement)
 *
 * Le service prend en entrée la liste d'events calendrier (déjà expansés
 * avec adresse + lat/lng), et retourne pour chaque paire consécutive :
 *  [
 *    'from_event_id' => '12-20260513',
 *    'to_event_id' => '14',
 *    'gap_minutes' => 32,
 *    'distance_km' => 4.2,
 *    'duration_minutes' => 12,
 *    'is_paid' => true,
 *    'source' => 'gmaps'|'haversine',
 *  ]
 *
 * Aussi expose un récap journée : total payé / non payé.
 */
class TripPlannerService
{
    public function __construct(
        private readonly GoogleMapsDistanceService $distance,
    ) {}

    /**
     * @param  Collection<int,array>  $events  Events triés par start_datetime
     * @return Collection<int,array>
     */
    public function computeTrips(Collection $events): Collection
    {
        $maxPaidMinutes = (int) AppSetting::get('paid_travel_max_minutes', 45);

        // Tri par employee puis par start
        $byEmployee = $events
            ->filter(fn ($e) => ($e['employee']['id'] ?? null) !== null)
            ->groupBy(fn ($e) => $e['employee']['id']);

        $trips = collect();

        foreach ($byEmployee as $employeeId => $list) {
            $sorted = $list->sortBy('start_datetime')->values();
            for ($i = 0; $i < $sorted->count() - 1; $i++) {
                $a = $sorted[$i];
                $b = $sorted[$i + 1];

                $endA = Carbon::parse($a['end_datetime']);
                $startB = Carbon::parse($b['start_datetime']);

                // Pas le même jour → on ignore (pas de trajet inter-jours)
                if (! $endA->isSameDay($startB)) continue;

                $gapMinutes = $endA->diffInMinutes($startB);

                // Coordonnées des adresses
                $latA = $a['client']['address']['latitude'] ?? null;
                $lngA = $a['client']['address']['longitude'] ?? null;
                $latB = $b['client']['address']['latitude'] ?? null;
                $lngB = $b['client']['address']['longitude'] ?? null;

                $dist = $this->distance->distance($latA, $lngA, $latB, $lngB);

                $trips->push([
                    'employee_id' => $employeeId,
                    'employee_name' => $a['employee']['name'] ?? null,
                    'from_event_id' => $a['id'],
                    'to_event_id' => $b['id'],
                    'from_end' => $endA->toIso8601String(),
                    'to_start' => $startB->toIso8601String(),
                    'gap_minutes' => $gapMinutes,
                    'distance_km' => $dist['distance_km'] ?? null,
                    'duration_minutes' => $dist['duration_minutes'] ?? null,
                    'is_paid' => $gapMinutes <= $maxPaidMinutes,
                    'source' => $dist['source'] ?? null,
                ]);
            }
        }

        return $trips;
    }

    /**
     * Récap journée par intervenant : total km/min payés vs non payés.
     */
    public function summarize(Collection $trips): Collection
    {
        return $trips->groupBy('employee_id')->map(function ($list, $employeeId) {
            $paid = $list->where('is_paid', true);
            $unpaid = $list->where('is_paid', false);
            return [
                'employee_id' => $employeeId,
                'employee_name' => $list->first()['employee_name'] ?? null,
                'paid_trips' => $paid->count(),
                'paid_distance_km' => round($paid->sum('distance_km'), 1),
                'paid_duration_minutes' => $paid->sum('duration_minutes'),
                'unpaid_trips' => $unpaid->count(),
                'unpaid_distance_km' => round($unpaid->sum('distance_km'), 1),
                'unpaid_duration_minutes' => $unpaid->sum('duration_minutes'),
            ];
        })->values();
    }
}
