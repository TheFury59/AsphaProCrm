<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'code',
        'status',
        'name',
        'entity_id',
        'type',
        'nature',
        'billing_mode',
        'category_id',
        'default_duration_minutes',
        'has_degressive_pricing',
        'price',
        'cost',
        'vat_rate_id',
        'amount_incl_tax',
        'specific_rates_forbidden',
        'accounting_code',
        'chapter',
        'description',
        'medical_visit_address_id',
    ];

    protected function casts(): array
    {
        return [
            'has_degressive_pricing' => 'boolean',
            'price' => 'decimal:2',
            'cost' => 'decimal:2',
            'amount_incl_tax' => 'boolean',
            'specific_rates_forbidden' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function vatRate(): BelongsTo
    {
        return $this->belongsTo(VatRate::class, 'vat_rate_id');
    }

    public function medicalVisitAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'medical_visit_address_id');
    }

    public function productPriceTiers(): HasMany
    {
        return $this->hasMany(ProductPriceTier::class, 'product_id');
    }

    public function clientPrestations(): HasMany
    {
        return $this->hasMany(ClientPrestation::class, 'product_id');
    }

}
