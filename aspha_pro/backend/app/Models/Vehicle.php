<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehicle extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'entity_id', 'license_plate', 'brand', 'model', 'year', 'fuel_type',
        'purchase_date', 'insurance_expires_at', 'next_inspection_at',
        'current_mileage', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'insurance_expires_at' => 'date',
            'next_inspection_at' => 'date',
            'current_mileage' => 'integer',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(VehicleAssignment::class);
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(VehicleMaintenance::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(VehicleIncident::class);
    }

    /**
     * Attribution en cours (end_date NULL).
     */
    public function currentAssignment()
    {
        return $this->hasOne(VehicleAssignment::class)->whereNull('end_date');
    }
}
