<?php

namespace App\Services;

use App\Models\Address;
use App\Models\Employee;
use App\Models\Intervention;
use Illuminate\Support\Collection;

/**
 * Matching auto intervenant pour une intervention (Phase 10 — "rêve cliente").
 *
 * Score composite [0..100] sur 4 axes pondérés :
 *  - skills (40 pts) : intersection entre prestations de l'intervention et compétences employé
 *  - proximity (30 pts) : distance Haversine entre adresse intervenant et adresse intervention
 *      ≤5 km = 30 pts, 5–15 km = 20 pts, 15–30 km = 10 pts, >30 km = 0
 *  - availability (20 pts) : conflits planning sur le créneau (0 conflit = 20 pts, sinon 0)
 *  - preference (10 pts) : intervenant déjà intervenu chez ce client (+10 si oui)
 *
 * Retourne les top N employés actifs triés par score décroissant.
 *
 * Limites MVP :
 *  - On ne tient compte ni des contrats temps partiel/temps plein
 *    ni des temps de trajet précis (juste Haversine vol d'oiseau)
 *  - Pas encore intégré au calendrier de chaque employé (juste collisions interventions)
 */
class InterventionMatchingService
{
    private const TOP_N = 10;

    public function findCandidates(Intervention $iv, int $limit = self::TOP_N): Collection
    {
        // 1. Récupère les employés actifs de la même entité que le client si présent
        $query = Employee::query()
            ->where('status', 'active')
            ->with([
                'skills:id',
                'addresses' => fn ($q) => $q->whereNotNull('latitude')->whereNotNull('longitude')->limit(1),
            ]);
        $employees = $query->get();

        if ($employees->isEmpty()) return collect();

        // 2. Charge données contextuelles
        $iv->loadMissing(['client.addresses', 'employee']);

        $interventionAddr = $this->resolveInterventionAddress($iv);
        $clientId = $iv->client_id;
        $start = $iv->start_datetime;
        $end = $iv->end_datetime;
        $requiredSkillIds = []; // À enrichir : prestations → compétences requises (table de mapping)

        $scored = $employees->map(function (Employee $e) use ($iv, $interventionAddr, $clientId, $start, $end, $requiredSkillIds) {
            $score = 0;
            $breakdown = [];

            // --- Skills (40 pts) ---
            $employeeSkillIds = $e->skills->pluck('id')->all();
            if (! empty($requiredSkillIds)) {
                $match = count(array_intersect($employeeSkillIds, $requiredSkillIds));
                $skillScore = min(40, $match * (40 / max(1, count($requiredSkillIds))));
            } else {
                // Pas de skills requis explicites → on neutralise à 25/40
                $skillScore = 25;
            }
            $score += $skillScore;
            $breakdown['skills'] = round($skillScore, 1);

            // --- Proximity (30 pts) ---
            $proxScore = 0;
            $distanceKm = null;
            if ($interventionAddr && $e->addresses->first()) {
                $empAddr = $e->addresses->first();
                if ($empAddr->latitude && $empAddr->longitude) {
                    $distanceKm = $this->haversineKm(
                        $interventionAddr->latitude, $interventionAddr->longitude,
                        $empAddr->latitude, $empAddr->longitude,
                    );
                    $proxScore = match (true) {
                        $distanceKm <= 5 => 30,
                        $distanceKm <= 15 => 20,
                        $distanceKm <= 30 => 10,
                        default => 0,
                    };
                }
            }
            $score += $proxScore;
            $breakdown['proximity'] = $proxScore;
            $breakdown['distance_km'] = $distanceKm !== null ? round($distanceKm, 1) : null;

            // --- Availability (20 pts) ---
            $availScore = 20;
            if ($start && $end) {
                $conflicts = Intervention::where('employee_id', $e->id)
                    ->where('id', '!=', $iv->id)
                    ->where('is_exception', false)
                    ->where(function ($q) use ($start, $end) {
                        $q->whereBetween('start_datetime', [$start, $end])
                          ->orWhereBetween('end_datetime', [$start, $end])
                          ->orWhere(function ($q) use ($start, $end) {
                              $q->where('start_datetime', '<=', $start)
                                ->where('end_datetime', '>=', $end);
                          });
                    })
                    ->exists();
                if ($conflicts) $availScore = 0;
            }
            $score += $availScore;
            $breakdown['availability'] = $availScore;

            // --- Préférence client (10 pts) ---
            $prefScore = 0;
            if ($clientId) {
                $previously = Intervention::where('employee_id', $e->id)
                    ->where('client_id', $clientId)
                    ->where('status', '!=', 'cancelled')
                    ->exists();
                if ($previously) $prefScore = 10;
            }
            $score += $prefScore;
            $breakdown['preference'] = $prefScore;

            return [
                'employee_id' => $e->id,
                'employee_name' => $e->name,
                'score' => round($score, 1),
                'breakdown' => $breakdown,
            ];
        });

        return $scored->sortByDesc('score')->take($limit)->values();
    }

    private function resolveInterventionAddress(Intervention $iv): ?Address
    {
        // Une intervention pointe sur le client → on prend l'adresse "intervention" du client.
        if (! $iv->relationLoaded('client') || ! $iv->client) return null;
        return $iv->client->addresses
            ->sortBy(fn ($a) => match ($a->type) {
                'intervention' => 0, 'main' => 1, default => 2,
            })
            ->first(fn ($a) => $a->latitude && $a->longitude);
    }

    /**
     * Distance Haversine vol d'oiseau en km.
     */
    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
