<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientAbsence extends Model
{
    protected $fillable = [
        'client_id',
        'reason_id',
        'is_hourly',
        'planning_action',
        'comment',
        'start_datetime',
        'duration_hours',
        'is_periodic',
        'start_date',
        'start_time',
        'end_time',
        'frequency',
        'interval',
        'days_of_week',
        'exclude_school_holidays',
        'exclude_public_holidays',
        'end_type',
        'end_date',
        'occurrences_count',
    ];

    protected function casts(): array
    {
        return [
            'is_hourly' => 'boolean',
            'start_datetime' => 'datetime',
            'duration_hours' => 'float',
            'is_periodic' => 'boolean',
            'start_date' => 'date',
            'exclude_school_holidays' => 'boolean',
            'exclude_public_holidays' => 'boolean',
            'end_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function reason(): BelongsTo
    {
        return $this->belongsTo(ClientAbsenceReason::class, 'reason_id');
    }

}
