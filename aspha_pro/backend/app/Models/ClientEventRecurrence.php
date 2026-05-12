<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientEventRecurrence extends Model
{
    protected $fillable = [
        'client_id',
        'event_type_id',
        'contact_id',
        'is_remote',
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
        'status',
        'next_recurrence_id',
    ];

    protected function casts(): array
    {
        return [
            'is_remote' => 'boolean',
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

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(ClientEventType::class, 'event_type_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(RelatedContact::class, 'contact_id');
    }

    public function customAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'custom_address_id');
    }

    public function nextRecurrence(): BelongsTo
    {
        return $this->belongsTo(ClientEventRecurrence::class, 'next_recurrence_id');
    }

}
