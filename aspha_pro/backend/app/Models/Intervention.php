<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Intervention extends Model
{
    use LogsActivity;

    protected $fillable = [
        'client_id',
        'mission_id',
        'client_prestation_id',
        'employee_id',
        'is_recurring',
        'status',
        'is_group',
        'start_datetime',
        'end_datetime',
        'recurrence_start_date',
        'start_time',
        'end_time',
        'frequency',
        'interval',
        'days_of_week',
        'exclude_holidays',
        'exclude_school_holidays',
        'end_type',
        'recurrence_end_date',
        'occurrences_count',
        'next_intervention_id',
        'parent_id',
        'is_exception',
        'exception_date',
        'replacement_employee_id',
        'replacement_reason',
        'is_paid',
        'is_billed',
        'bill_client',
        'adjustment_of_id',
        'comment',
        'internal_comment',
        'client_comment',
        'employee_comment',
        'transport_mode',
        'vehicle_type',
        'is_transport_fixed',
        'kms_done',
        'kms_paid',
    ];

    protected function casts(): array
    {
        return [
            'is_recurring' => 'boolean',
            'is_group' => 'boolean',
            'start_datetime' => 'datetime',
            'end_datetime' => 'datetime',
            'recurrence_start_date' => 'date',
            'exclude_holidays' => 'boolean',
            'exclude_school_holidays' => 'boolean',
            'recurrence_end_date' => 'date',
            'is_exception' => 'boolean',
            'exception_date' => 'date',
            'is_paid' => 'boolean',
            'is_billed' => 'boolean',
            'bill_client' => 'boolean',
            'is_transport_fixed' => 'boolean',
            'kms_done' => 'float',
            'kms_paid' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class, 'mission_id');
    }

    public function clientPrestation(): BelongsTo
    {
        return $this->belongsTo(ClientPrestation::class, 'client_prestation_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function nextIntervention(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'next_intervention_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'parent_id');
    }

    public function replacementEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'replacement_employee_id');
    }

    public function adjustmentOf(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'adjustment_of_id');
    }

    public function recurrenceAssignments(): HasMany
    {
        return $this->hasMany(RecurrenceAssignment::class, 'recurrence_id');
    }

    public function matchingRequests(): HasMany
    {
        return $this->hasMany(MatchingRequest::class, 'recurrence_id');
    }

    public function telemanagementLogs(): HasMany
    {
        return $this->hasMany(TelemanagementLog::class, 'intervention_id');
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(Checkin::class, 'intervention_id');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'intervention_id');
    }

}
