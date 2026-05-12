<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeEventRecurrence extends Model
{
    protected $fillable = [
        'employee_id',
        'contract_id',
        'event_type_id',
        'is_employee_paid',
        'address_type',
        'custom_address_id',
        'comment',
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
        'transport_mode',
        'is_transport_fixed',
        'kms_done',
    ];

    protected function casts(): array
    {
        return [
            'is_employee_paid' => 'boolean',
            'start_date' => 'date',
            'exclude_school_holidays' => 'boolean',
            'exclude_public_holidays' => 'boolean',
            'end_date' => 'date',
            'is_transport_fixed' => 'boolean',
            'kms_done' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(EmployeeEventType::class, 'event_type_id');
    }

    public function customAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'custom_address_id');
    }

}
