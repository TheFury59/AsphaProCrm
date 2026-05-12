<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Appointment extends Model
{
    use SoftDeletes;

    public const STATUS_PLANNED = 'planned';
    public const STATUS_DONE = 'done';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_NO_SHOW = 'no_show';

    protected $fillable = [
        'service_assignment_id', 'employee_id', 'client_address_id',
        'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end',
        'status', 'paid_to_employee', 'invoiced_to_client',
        'admin_notes', 'created_by_user_id', 'last_modified_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'actual_start' => 'datetime',
            'actual_end' => 'datetime',
            'paid_to_employee' => 'boolean',
            'invoiced_to_client' => 'boolean',
        ];
    }

    public function serviceAssignment(): BelongsTo
    {
        return $this->belongsTo(ServiceAssignment::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function clientAddress(): BelongsTo
    {
        return $this->belongsTo(ClientAddress::class);
    }

    public function qrScans(): HasMany
    {
        return $this->hasMany(QrScan::class);
    }

    public function durationMinutes(): int
    {
        return (int) $this->scheduled_start->diffInMinutes($this->scheduled_end);
    }
}
