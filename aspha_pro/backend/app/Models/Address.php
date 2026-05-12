<?php

namespace App\Models;

use App\Services\GeocodingService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Address extends Model
{
    public $timestamps = false;

    /**
     * Auto-géocodage à la sauvegarde si address/city/postal_code changent
     * et que lat/lng ne sont pas explicitement fournis.
     */
    protected static function booted(): void
    {
        static::saving(function (Address $addr) {
            $needsGeocode = $addr->isDirty(['address', 'city', 'postal_code'])
                && ! $addr->isDirty(['latitude', 'longitude']);

            if (! $needsGeocode) {
                return;
            }
            if (! $addr->address && ! $addr->city) {
                return;
            }

            try {
                $coords = app(GeocodingService::class)->geocode(
                    $addr->address,
                    $addr->postal_code,
                    $addr->city,
                );
                if ($coords) {
                    [$addr->latitude, $addr->longitude] = $coords;
                }
            } catch (\Throwable $e) {
                // Géocodage best-effort, on n'empêche jamais la sauvegarde
            }
        });
    }

    protected $fillable = [
        'owner_type',
        'owner_id',
        'type',
        'address',
        'city',
        'postal_code',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'medical_visit_address_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'address_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'medical_visit_address_id');
    }

    public function clientEvents(): HasMany
    {
        return $this->hasMany(ClientEvent::class, 'custom_address_id');
    }

    public function clientEventRecurrences(): HasMany
    {
        return $this->hasMany(ClientEventRecurrence::class, 'custom_address_id');
    }

    public function employeeEvents(): HasMany
    {
        return $this->hasMany(EmployeeEvent::class, 'custom_address_id');
    }

    public function employeeEventRecurrences(): HasMany
    {
        return $this->hasMany(EmployeeEventRecurrence::class, 'custom_address_id');
    }

    public function qrCodes(): HasMany
    {
        return $this->hasMany(QrCode::class, 'address_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'intervention_address_id');
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

}
