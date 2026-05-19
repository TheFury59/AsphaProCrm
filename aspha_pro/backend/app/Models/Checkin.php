<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Checkin extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'employee_id',
        'intervention_id',
        'qr_code_id',
        'checkin_time',
        'checkout_time',
        'latitude',
        'longitude',
        'flag_no_gps', // audit 2026-05-19 — mode dégradé sans GPS
    ];

    protected function casts(): array
    {
        return [
            'checkin_time' => 'datetime',
            'checkout_time' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
            'flag_no_gps' => 'boolean', // audit 2026-05-19
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function intervention(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'intervention_id');
    }

    public function qrCode(): BelongsTo
    {
        return $this->belongsTo(QrCode::class, 'qr_code_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'checkin_id');
    }

}
