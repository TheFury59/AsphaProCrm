<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockInventoryLine extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'inventory_id',
        'stock_product_id',
        'expected_quantity',
        'actual_quantity',
        'gap',
        'comment',
    ];

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(StockInventory::class, 'inventory_id');
    }

    public function stockProduct(): BelongsTo
    {
        return $this->belongsTo(StockProduct::class, 'stock_product_id');
    }

}
