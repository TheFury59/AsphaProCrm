<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Message posté dans le fil de discussion d'un ticket (`client_requests`).
 *
 * L'émission de la notification aux autres participants est gérée par
 * ClientRequestMessageObserver (point d'émission unique — cf. LRN 2026-05-18).
 */
class ClientRequestMessage extends Model
{
    protected $fillable = [
        'client_request_id',
        'sender_id',
        'body',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function clientRequest(): BelongsTo
    {
        return $this->belongsTo(ClientRequest::class, 'client_request_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
