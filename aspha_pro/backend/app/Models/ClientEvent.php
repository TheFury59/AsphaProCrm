<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientEvent extends Model
{
    protected $fillable = [
        'client_id',
        'event_type_id',
        'contact_id',
        'date',
        'duration_minutes',
        'is_cancelled',
        'is_remote',
        'address_type',
        'custom_address_id',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'datetime',
            'is_cancelled' => 'boolean',
            'is_remote' => 'boolean',
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

}
