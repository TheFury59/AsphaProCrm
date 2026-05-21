<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Produit de stock (consommable/matériel) consommé dans le cadre d'une mission.
 *
 * RÈGLE MÉTIER (2026-05-21) : la création/suppression/modification d'une ligne
 * référençant un `stock_product_id` déclenche un mouvement de stock (cf.
 * MissionController + StockMovementService). Une ligne libre
 * (`stock_product_id` null) ne déclenche aucun mouvement.
 */
class MissionStockItem extends Model
{
    protected $fillable = [
        'mission_id',
        'stock_product_id',
        'label',
        'quantity',
        'unit_price',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class, 'mission_id');
    }

    public function stockProduct(): BelongsTo
    {
        return $this->belongsTo(StockProduct::class, 'stock_product_id');
    }
}
