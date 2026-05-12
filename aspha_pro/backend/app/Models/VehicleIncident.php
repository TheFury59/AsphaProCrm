<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleIncident extends Model
{
    protected $fillable = [
        'vehicle_id', 'employee_id', 'incident_at', 'type', 'severity',
        'description', 'repair_cost', 'insurance_claim_ref', 'status',
    ];

    protected function casts(): array
    {
        return [
            'incident_at' => 'datetime',
            'repair_cost' => 'decimal:2',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
