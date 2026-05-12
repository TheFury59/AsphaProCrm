<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAbsence extends Model
{
    protected $fillable = [
        'employee_id',
        'reason_id',
        'entry_type',
        'is_hourly',
        'planning_action',
        'justification_status',
        'start_datetime',
        'duration_hours',
        'is_periodic',
        'start_date',
        'is_full_day',
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
        'transfer_prestation',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'is_hourly' => 'boolean',
            'start_datetime' => 'datetime',
            'duration_hours' => 'float',
            'is_periodic' => 'boolean',
            'start_date' => 'date',
            'is_full_day' => 'boolean',
            'exclude_school_holidays' => 'boolean',
            'exclude_public_holidays' => 'boolean',
            'end_date' => 'date',
            'transfer_prestation' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function reason(): BelongsTo
    {
        return $this->belongsTo(AbsenceReason::class, 'reason_id');
    }

}
