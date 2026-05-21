<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuoteItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'quote_id',
        'product_id', // 2026-05-20 — prestation catalogue source (null = ligne libre)
        'stock_product_id', // 2026-05-21 — produit du stock (null = ligne libre / prestation)
        'item_type',
        'vat_rate_id', // audit 2026-05-19 — TVA dynamique par ligne
        'label',
        'quantity',
        'unit_price',
        'total',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
            'order' => 'integer',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    // audit 2026-05-19 — TVA dynamique par ligne (sinon fallback 20% au calcul)
    public function vatRate(): BelongsTo
    {
        return $this->belongsTo(VatRate::class, 'vat_rate_id');
    }

    // 2026-05-21 — produit du stock chiffré dans le devis (null = ligne libre)
    public function stockProduct(): BelongsTo
    {
        return $this->belongsTo(StockProduct::class, 'stock_product_id');
    }
}
