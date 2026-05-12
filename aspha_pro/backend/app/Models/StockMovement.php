<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    protected $fillable = [
        'stock_product_id',
        'movement_type',
        'quantity',
        'reason',
        'reference_id',
        'done_by',
        'movement_date',
    ];

    protected function casts(): array
    {
        return [
            'movement_date' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function stockProduct(): BelongsTo
    {
        return $this->belongsTo(StockProduct::class, 'stock_product_id');
    }

    public function doneBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'done_by');
    }

}
