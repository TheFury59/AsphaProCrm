<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QrCode extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'address_id',
        'event_type_id',
        'type',
        'code',
        'status',
        'expires_at', // audit 2026-05-19 — QR optionnellement expirable
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime', // audit 2026-05-19
        ];
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'address_id');
    }

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(EmployeeEventType::class, 'event_type_id');
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(Checkin::class, 'qr_code_id');
    }

}
