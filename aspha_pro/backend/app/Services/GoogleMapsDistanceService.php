<?php

namespace App\Services;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Service de calcul distance + temps de trajet via Google Maps Distance Matrix API.
 *
 * Endpoint : https://maps.googleapis.com/maps/api/distancematrix/json
 * Clé API stockée dans app_settings.google_maps_api_key (paramétrable depuis UI),
 * fallback sur env GOOGLE_MAPS_API_KEY. Si aucune clé → fallback Haversine.
 *
 * Cache 7 jours sur (origin + dest) — les trajets entre 2 adresses fixes
 * ne changent pas (sauf travaux). Réduit massivement le coût (~5€/1000 req
 * uncached → ~0,01€/1000 req cached).
 *
 * Retourne ['distance_km' => float, 'duration_minutes' => int, 'source' => 'gmaps'|'haversine']
 * ou null si géocodage impossible.
 */
class GoogleMapsDistanceService
{
    private const CACHE_TTL_DAYS = 7;
    private const ENDPOINT = 'https://maps.googleapis.com/maps/api/distancematrix/json';

    public function distance(
        ?float $fromLat, ?float $fromLng,
        ?float $toLat, ?float $toLng,
        string $mode = 'driving',
    ): ?array {
        if (! $fromLat || ! $fromLng || ! $toLat || ! $toLng) {
            return null;
        }

        $cacheKey = sprintf(
            'gmaps:%s:%.4f,%.4f:%.4f,%.4f',
            $mode, $fromLat, $fromLng, $toLat, $toLng,
        );

        return Cache::remember($cacheKey, now()->addDays(self::CACHE_TTL_DAYS), function () use (
            $fromLat, $fromLng, $toLat, $toLng, $mode,
        ) {
            $key = AppSetting::get('google_maps_api_key') ?: env('GOOGLE_MAPS_API_KEY');

            if (! $key) {
                // Fallback Haversine — pas de coût, précision moindre
                return $this->haversine($fromLat, $fromLng, $toLat, $toLng);
            }

            try {
                $response = Http::timeout(8)->get(self::ENDPOINT, [
                    'origins' => "$fromLat,$fromLng",
                    'destinations' => "$toLat,$toLng",
                    'mode' => $mode,
                    'language' => 'fr',
                    'units' => 'metric',
                    'key' => $key,
                ]);

                if (! $response->successful()) {
                    Log::warning('GMaps Distance Matrix HTTP error', ['status' => $response->status()]);
                    return $this->haversine($fromLat, $fromLng, $toLat, $toLng);
                }

                $data = $response->json();
                $element = $data['rows'][0]['elements'][0] ?? null;
                if (! $element || ($element['status'] ?? '') !== 'OK') {
                    return $this->haversine($fromLat, $fromLng, $toLat, $toLng);
                }

                return [
                    'distance_km' => round(($element['distance']['value'] ?? 0) / 1000, 1),
                    'duration_minutes' => (int) round(($element['duration']['value'] ?? 0) / 60),
                    'source' => 'gmaps',
                ];
            } catch (\Throwable $e) {
                Log::warning('GMaps exception', ['error' => $e->getMessage()]);
                return $this->haversine($fromLat, $fromLng, $toLat, $toLng);
            }
        });
    }

    /**
     * Fallback Haversine + estimation duration (40 km/h moyenne en zone urbaine/péri).
     */
    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): array
    {
        $R = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $km = $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
        return [
            'distance_km' => round($km, 1),
            'duration_minutes' => (int) round(($km / 40) * 60),  // ~40 km/h moyen
            'source' => 'haversine',
        ];
    }
}
