<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Géocodage via la Base Adresse Nationale (BAN) — api-adresse.data.gouv.fr.
 *
 * Service public, gratuit, sans clé API, limite 50 req/sec/IP (largement suffisant).
 * Pour fallback international futur : Nominatim (OpenStreetMap) ou Photon.
 *
 * Endpoint : GET https://api-adresse.data.gouv.fr/search/?q=...&postcode=...
 *
 * Cache 30 jours par adresse pour éviter de spammer l'API à chaque save.
 */
class GeocodingService
{
    private const BAN_ENDPOINT = 'https://api-adresse.data.gouv.fr/search/';
    private const CACHE_TTL_DAYS = 30;

    /**
     * Géocode une adresse. Retourne [lat, lng] ou null si non géocodable.
     *
     * @return array{0: float, 1: float}|null
     */
    public function geocode(?string $address, ?string $postalCode, ?string $city): ?array
    {
        $query = trim(implode(' ', array_filter([$address, $postalCode, $city])));
        if ($query === '' || strlen($query) < 5) {
            return null;
        }

        $cacheKey = 'geocode:' . md5($query);
        return Cache::remember($cacheKey, now()->addDays(self::CACHE_TTL_DAYS), function () use ($query, $postalCode) {
            try {
                $params = ['q' => $query, 'limit' => 1, 'autocomplete' => 0];
                if ($postalCode) {
                    $params['postcode'] = $postalCode;
                }

                $response = Http::timeout(5)
                    ->retry(2, 200)
                    ->get(self::BAN_ENDPOINT, $params);

                if (! $response->successful()) {
                    Log::warning('Geocoding BAN HTTP failed', ['query' => $query, 'status' => $response->status()]);
                    return null;
                }

                $features = $response->json('features', []);
                if (empty($features)) {
                    return null;
                }

                $coords = $features[0]['geometry']['coordinates'] ?? null;
                if (! $coords || count($coords) !== 2) {
                    return null;
                }

                // BAN renvoie [lon, lat]
                return [(float) $coords[1], (float) $coords[0]];
            } catch (\Throwable $e) {
                Log::warning('Geocoding BAN exception', ['query' => $query, 'error' => $e->getMessage()]);
                return null;
            }
        });
    }
}
