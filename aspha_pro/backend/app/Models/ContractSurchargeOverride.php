<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractSurchargeOverride extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'contract_id',
        'surcharge_rule_id',
        'custom_rate',
        'custom_rate_type',
    ];

    protected function casts(): array
    {
        return [
            'custom_rate' => 'decimal:2',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function surchargeRule(): BelongsTo
    {
        return $this->belongsTo(SurchargeRule::class, 'surcharge_rule_id');
    }

}
