<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelemanagementLog extends Model
{
    protected $fillable = [
        'origin',
        'event_type',
        'is_unrecognized',
        'called_at',
        'employee_id',
        'client_id',
        'intervention_id',
        'intervention_quality',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'is_unrecognized' => 'boolean',
            'called_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function intervention(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'intervention_id');
    }

}
