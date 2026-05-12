<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrScan extends Model
{
    public const TYPE_CHECK_IN = 'check_in';
    public const TYPE_CHECK_OUT = 'check_out';

    protected $fillable = [
        'appointment_id', 'qr_code_id', 'employee_id',
        'scanned_at', 'scan_type', 'geo_lat', 'geo_lng',
        'offline_synced_at', 'raw_payload',
    ];

    protected function casts(): array
    {
        return [
            'scanned_at' => 'datetime',
            'offline_synced_at' => 'datetime',
            'geo_lat' => 'decimal:7',
            'geo_lng' => 'decimal:7',
            'raw_payload' => 'array',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
