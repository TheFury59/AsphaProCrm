<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceAssignment extends Model
{
    use SoftDeletes;

    public const TYPE_PUNCTUAL = 'punctual';
    public const TYPE_RECURRING = 'recurring';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_ENDED = 'ended';

    protected $fillable = [
        'client_id', 'client_address_id', 'service_id', 'default_employee_id',
        'type', 'hourly_rate', 'duration_minutes',
        'scheduled_date', 'scheduled_time',
        'recurrence_start', 'recurrence_end', 'recurrence_time', 'recurrence_rule',
        'status', 'created_by_user_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'recurrence_start' => 'date',
            'recurrence_end' => 'date',
            'hourly_rate' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function clientAddress(): BelongsTo
    {
        return $this->belongsTo(ClientAddress::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function defaultEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'default_employee_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function isRecurring(): bool
    {
        return $this->type === self::TYPE_RECURRING;
    }

    public function effectiveHourlyRate(): float
    {
        return (float) ($this->hourly_rate ?? $this->service->default_hourly_rate ?? 0);
    }
}
