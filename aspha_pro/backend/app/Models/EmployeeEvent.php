<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeEvent extends Model
{
    protected $fillable = [
        'employee_id',
        'contract_id',
        'event_type_id',
        'event_date',
        'duration_minutes',
        'is_employee_paid',
        'impacts_modulation',
        'address_type',
        'custom_address_id',
        'comment',
        'employee_comment',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'is_employee_paid' => 'boolean',
            'impacts_modulation' => 'boolean',
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
