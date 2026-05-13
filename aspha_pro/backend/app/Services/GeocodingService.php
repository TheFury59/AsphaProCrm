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

        // ⚠️ On ne `Cache::remember()` pas directement car ça mettrait `null`
        // (échec) en cache pour 30 jours → une adresse corrigée resterait
        // bloquée jusqu'à l'expiration. On gère le cache MANUELLEMENT pour ne
        // mémoriser que les succès.
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $params = ['q' => $query, 'limit' => 1, 'autocomplete' => 0];
            if ($postalCode) {
                $params['postcode'] = $postalCode;
            }

            // ⚠️ SSL : PHP sous Windows n'a pas de bundle CA installé par défaut →
            // cURL error 60 sur les appels HTTPS. En dev (APP_ENV=local) on
            // désactive la vérification (BAN est public, pas de secret transitant).
            // En prod Linux, openssl du système gère les CA, pas besoin.
            $http = Http::timeout(5)->retry(2, 200);
            if (app()->environment('local')) {
                $http = $http->withOptions(['verify' => false]);
            }
            $response = $http->get(self::BAN_ENDPOINT, $params);

            if (! $response->successful()) {
                Log::warning('Geocoding BAN HTTP failed', ['query' => $query, 'status' => $response->status()]);
                return null;
            }

            $features = $response->json('features', []);
            if (empty($features)) {
                Log::info('Geocoding : aucun résultat BAN', ['query' => $query]);
                return null;
            }

            $coords = $features[0]['geometry']['coordinates'] ?? null;
            if (! $coords || count($coords) !== 2) {
                return null;
            }

            // BAN renvoie [lon, lat] — on stocke [lat, lng]
            $result = [(float) $coords[1], (float) $coords[0]];
            Cache::put($cacheKey, $result, now()->addDays(self::CACHE_TTL_DAYS));
            return $result;
        } catch (\Throwable $e) {
            Log::warning('Geocoding BAN exception', ['query' => $query, 'error' => $e->getMessage()]);
            return null;
        }
    }
}
