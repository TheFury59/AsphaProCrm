<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientEventType extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'label',
        'status',
        'planning_color',
    ];

    public function clientEvents(): HasMany
    {
        return $this->hasMany(ClientEvent::class, 'event_type_id');
    }

    public function clientEventRecurrences(): HasMany
    {
        return $this->hasMany(ClientEventRecurrence::class, 'event_type_id');
    }

}
