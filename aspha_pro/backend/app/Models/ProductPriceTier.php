<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPriceTier extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'product_id',
        'from_quantity',
        'price',
    ];

    protected function casts(): array
    {
        return [
            'from_quantity' => 'decimal:2',
            'price' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

}
