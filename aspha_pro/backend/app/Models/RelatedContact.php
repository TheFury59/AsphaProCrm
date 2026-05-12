<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RelatedContact extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'client_id',
        'type',
        'name',
        'phone',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function clientEvents(): HasMany
    {
        return $this->hasMany(ClientEvent::class, 'contact_id');
    }

    public function clientEventRecurrences(): HasMany
    {
        return $this->hasMany(ClientEventRecurrence::class, 'contact_id');
    }

}
