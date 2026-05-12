<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockInventory extends Model
{
    protected $fillable = [
        'entity_id',
        'done_by',
        'inventory_date',
        'comment',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'inventory_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function doneBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'done_by');
    }

    public function stockInventoryLines(): HasMany
    {
        return $this->hasMany(StockInventoryLine::class, 'inventory_id');
    }

}
