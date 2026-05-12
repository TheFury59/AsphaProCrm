<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NotificationType extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'code',
        'label',
        'module',
        'default_channels',
        'status',
    ];

    public function notificationPreferences(): HasMany
    {
        return $this->hasMany(NotificationPreference::class, 'notification_type_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'notification_type_id');
    }

}
