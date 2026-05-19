<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Gestion des settings applicatifs paramétrables depuis l'UI super-admin.
 *
 * Les settings sont stockés en BDD (table app_settings) avec une valeur JSON
 * typée. Cache 60s pour éviter les hits BDD répétés.
 *
 * Sécurité : seul super_admin peut update.
 * Les settings avec is_secret=true ont leur valeur masquée en GET (mais on
 * indique si elle est définie ou non).
 */
class SettingsController extends Controller
{
    public function index(Request $request)
    {
        // Sécurité : la liste complète des settings (incl. inventaire des
        // intégrations) ne doit pas être visible aux non-admin. Cf. audit
        // 2026-05-19 (HIGH).
        abort_unless(
            $request->user()?->hasRole('super_admin') || $request->user()?->hasRole('admin'),
            403,
        );

        $settings = AppSetting::orderBy('category')->orderBy('key')->get();
        return ['data' => $settings->map(function ($s) {
            $value = $s->value['value'] ?? null;
            return [
                'id' => $s->id,
                'key' => $s->key,
                'category' => $s->category,
                'label' => $s->label,
                'description' => $s->description,
                'value' => $s->is_secret ? ($value ? '••••••••' : null) : $value,
                'value_type' => $s->value_type,
                'is_secret' => $s->is_secret,
                'is_set' => $value !== null && $value !== '',
            ];
        })];
    }

    public function update(Request $request, string $key)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);

        $setting = AppSetting::where('key', $key)->firstOrFail();
        $data = $request->validate([
            'value' => ['nullable'],
        ]);

        // Cast côté serveur selon value_type
        $value = $data['value'] ?? null;
        $value = match ($setting->value_type) {
            'integer' => $value !== null ? (int) $value : null,
            'boolean' => (bool) $value,
            'array' => is_array($value) ? $value : [],
            default => $value !== null ? (string) $value : null,
        };

        $setting->update(['value' => ['value' => $value]]);
        Cache::forget("app_setting:$key");

        return ['data' => $setting->fresh()];
    }

    /**
     * Endpoint "public" (auth Sanctum requise) : retourne uniquement les
     * settings non sensibles utiles au front pour configurer l'UI.
     *
     * Note : `silae_portal_url` est exposé uniquement aux admin + intervenant
     * (qui en a besoin pour le bouton "Ouvrir Silae" sur son extranet). Les
     * clients (rôle `client`) n'y ont pas accès.
     */
    public function publicSettings(Request $request)
    {
        $user = $request->user();
        $payload = [
            'long_absence_threshold_days' => AppSetting::get('long_absence_threshold_days', 5),
            'paid_travel_max_minutes' => AppSetting::get('paid_travel_max_minutes', 45),
            'badge_late_threshold_minutes' => AppSetting::get('badge_late_threshold_minutes', 5),
            'stock_alert_default_threshold' => AppSetting::get('stock_alert_default_threshold', 10),
            'silae_api_enabled' => (bool) AppSetting::get('silae_api_enabled', false),
            'google_maps_enabled' => (bool) AppSetting::get('google_maps_api_key'),
        ];

        // silae_portal_url : seulement pour admin + intervenant
        if ($user?->hasRole('super_admin') || $user?->hasRole('admin') || $user?->hasRole('intervenant')) {
            $payload['silae_portal_url'] = AppSetting::get('silae_portal_url');
        }

        return ['data' => $payload];
    }
}
