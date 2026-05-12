<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Address extends Model
{
    public $timestamps = false;

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
