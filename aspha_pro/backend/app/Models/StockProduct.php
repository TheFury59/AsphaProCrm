<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockProduct extends Model
{
    protected $fillable = [
        'entity_id',
        'category_id',
        'name',
        'reference',
        'unit',
        'alert_threshold',
        'current_quantity',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(StockCategory::class, 'category_id');
    }

    public function consumableReorders(): HasMany
    {
        return $this->hasMany(ConsumableReorder::class, 'stock_product_id');
    }

    public function stockInventoryLines(): HasMany
    {
        return $this->hasMany(StockInventoryLine::class, 'stock_product_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'stock_product_id');
    }

}
