<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleMaintenance extends Model
{
    protected $fillable = [
        'vehicle_id', 'type', 'performed_at', 'mileage', 'cost',
        'provider', 'description', 'next_due_at',
    ];

    protected function casts(): array
    {
        return [
            'performed_at' => 'date',
            'next_due_at' => 'date',
            'mileage' => 'integer',
            'cost' => 'decimal:2',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
