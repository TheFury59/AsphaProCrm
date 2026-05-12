<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SepaOrder extends Model
{
    protected $fillable = [
        'entity_id',
        'entity_bank_account_id',
        'lot_number',
        'operation_date',
        'total_amount',
        'format',
        'status',
        'file_path',
    ];

    protected function casts(): array
    {
        return [
            'operation_date' => 'date',
            'total_amount' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function entityBankAccount(): BelongsTo
    {
        return $this->belongsTo(EntityBankAccount::class, 'entity_bank_account_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'sepa_order_id');
    }

}
