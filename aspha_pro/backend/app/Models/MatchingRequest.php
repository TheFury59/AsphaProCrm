<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchingRequest extends Model
{
    protected $fillable = [
        'recurrence_id',
        'intervention_id',
        'requested_by',
        'assignment_type',
        'start_date',
        'end_date',
        'status',
        'selected_employee_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function recurrence(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'recurrence_id');
    }

    public function intervention(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'intervention_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function selectedEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'selected_employee_id');
    }

}
