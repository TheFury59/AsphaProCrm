<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClientPrestation extends Model
{
    use SoftDeletes;

    public $timestamps = false;

    protected $fillable = [
        'client_id',
        'mission_id',
        'product_id',
        'quote_id',
        'label',
        'start_date',
        'end_date',
        'billing_type',
        'pricing_type',
        'custom_price',
        'base_price',
        'no_intervention_no_bill',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'custom_price' => 'decimal:2',
            'base_price' => 'decimal:2',
            'no_intervention_no_bill' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class, 'mission_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'client_prestation_id');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'client_prestation_id');
    }

}
