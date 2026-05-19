<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Token FCM (ou autre push provider) enregistré pour un user.
 *
 * audit 2026-05-19 — table créée vide, à alimenter quand l'app mobile sera
 * livrée. Le job SendPushNotificationJob lit le 1er token actif de l'user
 * pour router la notif.
 */
class DeviceToken extends Model
{
    protected $fillable = [
        'user_id',
        'token',
        'device_type', // 'ios', 'android', 'web'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
