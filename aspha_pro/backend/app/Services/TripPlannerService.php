<?php

namespace App\Services;

use App\Models\Address;
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

            // ============================================================
            // Trajet "domicile → premier RDV du jour" (jamais payé)
            // ============================================================
            // Règle métier : le déplacement domicile → 1er client de chaque
            // journée est un trajet visible (affiché sur la map et la timeline)
            // mais JAMAIS payé (c'est un trajet personnel non remboursé).
            // Implémentation : pour chaque journée travaillée, on insère un
            // segment artificiel avant le 1er RDV avec is_paid=false +
            // is_home_origin=true.
            $homeAddr = $this->getEmployeeHomeAddress($employeeId);
            if ($homeAddr && $homeAddr->latitude && $homeAddr->longitude) {
                // Identifier les "premiers RDV de chaque jour"
                $firstByDay = $sorted->groupBy(
                    fn ($e) => Carbon::parse($e['start_datetime'])->toDateString(),
                )->map(fn ($dayEvents) => $dayEvents->first());

                foreach ($firstByDay as $firstEv) {
                    $latB = $firstEv['client']['address']['latitude'] ?? null;
                    $lngB = $firstEv['client']['address']['longitude'] ?? null;
                    if ($latB === null || $lngB === null) continue;

                    $startB = Carbon::parse($firstEv['start_datetime']);
                    $dist = $this->distance->distance(
                        $homeAddr->latitude, $homeAddr->longitude,
                        $latB, $lngB,
                    );
                    $duration = $dist['duration_minutes'] ?? null;
                    $departureTime = $duration !== null
                        ? $startB->copy()->subMinutes((int) $duration)
                        : null;

                    $trips->push([
                        'employee_id' => $employeeId,
                        'employee_name' => $firstEv['employee']['name'] ?? null,
                        'is_home_origin' => true,
                        'from_event_id' => null,
                        'to_event_id' => $firstEv['id'],
                        'from_address' => [
                            'label' => 'Domicile',
                            'address' => $homeAddr->address,
                            'city' => $homeAddr->city,
                            'postal_code' => $homeAddr->postal_code,
                            'latitude' => (float) $homeAddr->latitude,
                            'longitude' => (float) $homeAddr->longitude,
                        ],
                        'to_address' => [
                            'label' => $firstEv['client']['company_name']
                                ?? $firstEv['client']['code'] ?? 'Client',
                            'address' => $firstEv['client']['address']['address'] ?? null,
                            'city' => $firstEv['client']['address']['city'] ?? null,
                            'postal_code' => $firstEv['client']['address']['postal_code'] ?? null,
                            'latitude' => (float) $latB,
                            'longitude' => (float) $lngB,
                        ],
                        'from_end' => $departureTime?->toIso8601String(),
                        'to_start' => $startB->toIso8601String(),
                        // gap_minutes : par convention 0 pour les trajets domicile
                        // (pas de "pause" applicable, c'est un déplacement direct)
                        'gap_minutes' => 0,
                        'distance_km' => $dist['distance_km'] ?? null,
                        'duration_minutes' => $duration,
                        'is_paid' => false,  // ← TOUJOURS non payé
                        'source' => $dist['source'] ?? null,
                    ]);
                }
            }

            // ============================================================
            // Trajets inter-RDV classiques (règle des 45 min)
            // ============================================================
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
                    'is_home_origin' => false,
                    'from_event_id' => $a['id'],
                    'to_event_id' => $b['id'],
                    'from_address' => [
                        'label' => $a['client']['company_name'] ?? $a['client']['code'] ?? 'Client',
                        'address' => $a['client']['address']['address'] ?? null,
                        'city' => $a['client']['address']['city'] ?? null,
                        'postal_code' => $a['client']['address']['postal_code'] ?? null,
                        'latitude' => $latA !== null ? (float) $latA : null,
                        'longitude' => $lngA !== null ? (float) $lngA : null,
                    ],
                    'to_address' => [
                        'label' => $b['client']['company_name'] ?? $b['client']['code'] ?? 'Client',
                        'address' => $b['client']['address']['address'] ?? null,
                        'city' => $b['client']['address']['city'] ?? null,
                        'postal_code' => $b['client']['address']['postal_code'] ?? null,
                        'latitude' => $latB !== null ? (float) $latB : null,
                        'longitude' => $lngB !== null ? (float) $lngB : null,
                    ],
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

        // Tri final : par employee + par from_end pour que le frontend
        // puisse afficher les trajets dans l'ordre chronologique de la journée.
        return $trips->sortBy([
            ['employee_id', 'asc'],
            ['from_end', 'asc'],
        ])->values();
    }

    /**
     * Adresse domicile de l'intervenant (Address polymorphique owner_type='employee',
     * type='main'). Cache simple en mémoire pour éviter N requêtes dans une même
     * boucle.
     */
    private array $homeAddressCache = [];

    private function getEmployeeHomeAddress(int $employeeId): ?Address
    {
        if (array_key_exists($employeeId, $this->homeAddressCache)) {
            return $this->homeAddressCache[$employeeId];
        }
        $addr = Address::where('owner_type', 'employee')
            ->where('owner_id', $employeeId)
            ->where('type', 'main')
            ->first();
        return $this->homeAddressCache[$employeeId] = $addr;
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
