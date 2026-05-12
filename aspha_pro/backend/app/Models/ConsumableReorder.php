<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsumableReorder extends Model
{
    protected $fillable = [
        'client_id',
        'stock_product_id',
        'quantity_requested',
        'comment',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function stockProduct(): BelongsTo
    {
        return $this->belongsTo(StockProduct::class, 'stock_product_id');
    }

}
