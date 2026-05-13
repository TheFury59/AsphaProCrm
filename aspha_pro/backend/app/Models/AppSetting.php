<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Settings globaux typés. Accès via static helper `AppSetting::get($key, $default)`.
 * Cache 60s pour éviter le hit DB sur chaque requête.
 */
class AppSetting extends Model
{
    protected $fillable = [
        'key', 'category', 'label', 'description',
        'value', 'value_type', 'is_secret',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'array',  // stocké JSON, manipulé en mixed
            'is_secret' => 'boolean',
        ];
    }

    /**
     * Lecture cachée. Valeur déjà castée selon value_type.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::remember("app_setting:$key", 60, function () use ($key, $default) {
            $row = static::where('key', $key)->first();
            if (! $row) return $default;
            // value est stocké en JSON ; on extrait selon le type
            $v = $row->value;
            if (is_array($v) && array_key_exists('value', $v)) {
                $v = $v['value'];  // format {value: ...} pour wrap les scalaires
            }
            return match ($row->value_type) {
                'integer' => (int) $v,
                'boolean' => (bool) $v,
                'array' => is_array($v) ? $v : [],
                default => $v,
            };
        });
    }

    public static function put(string $key, mixed $value): void
    {
        $row = static::where('key', $key)->first();
        if (! $row) return;
        $row->update(['value' => ['value' => $value]]);
        Cache::forget("app_setting:$key");
    }
}
