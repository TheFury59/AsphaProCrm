<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Key extends Model
{
    use SoftDeletes;

    public $timestamps = false;

    protected $fillable = [
        'client_id',
        'label',
        'current_holder',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function keyMovements(): HasMany
    {
        return $this->hasMany(KeyMovement::class, 'key_id');
    }

}
