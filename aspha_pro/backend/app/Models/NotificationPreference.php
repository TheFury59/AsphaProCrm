<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'notification_type_id',
        'via_push',
        'via_email',
        'via_sms',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return [
            'via_push' => 'boolean',
            'via_email' => 'boolean',
            'via_sms' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function notificationType(): BelongsTo
    {
        return $this->belongsTo(NotificationType::class, 'notification_type_id');
    }

}
