<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EntityBankAccount extends Model
{
    protected $fillable = [
        'entity_id',
        'label',
        'iban',
        'bic',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function sepaMandates(): HasMany
    {
        return $this->hasMany(SepaMandate::class, 'entity_bank_account_id');
    }

    public function sepaOrders(): HasMany
    {
        return $this->hasMany(SepaOrder::class, 'entity_bank_account_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'entity_bank_account_id');
    }

}
