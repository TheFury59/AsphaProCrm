<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KmIndemnityRate extends Model
{
    protected $fillable = [
        'entity_id',
        'label',
        'transport_mode',
        'rate_per_km',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'rate_per_km' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

}
