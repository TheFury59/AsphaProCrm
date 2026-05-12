<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SurchargeRule extends Model
{
    protected $fillable = [
        'label',
        'type',
        'rate',
        'rate_type',
        'applies_from',
        'applies_to',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function contractSurchargeOverrides(): HasMany
    {
        return $this->hasMany(ContractSurchargeOverride::class, 'surcharge_rule_id');
    }

    public function quoteSurchargeRules(): HasMany
    {
        return $this->hasMany(QuoteSurchargeRule::class, 'surcharge_rule_id');
    }

}
