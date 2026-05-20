<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'invoice_id',
        'product_id', // 2026-05-20 — prestation catalogue source (null = ligne libre)
        'client_prestation_id',
        'intervention_id',
        'item_type',
        'vat_rate_id', // audit 2026-05-19 — TVA dynamique par ligne
        'label',
        'quantity',
        'unit_price',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    public function clientPrestation(): BelongsTo
    {
        return $this->belongsTo(ClientPrestation::class, 'client_prestation_id');
    }

    public function intervention(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'intervention_id');
    }

    // audit 2026-05-19 — TVA dynamique par ligne (sinon fallback 20% au calcul)
    public function vatRate(): BelongsTo
    {
        return $this->belongsTo(VatRate::class, 'vat_rate_id');
    }

}
