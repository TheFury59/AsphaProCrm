<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SepaMandate extends Model
{
    protected $fillable = [
        'client_id',
        'entity_id',
        'entity_bank_account_id',
        'debtor_bank_account_id',
        'mandate_reference',
        'creditor_id',
        'contract_description',
        'signed_at',
        'sequence_type',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'signed_at' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function entityBankAccount(): BelongsTo
    {
        return $this->belongsTo(EntityBankAccount::class, 'entity_bank_account_id');
    }

    public function debtorBankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'debtor_bank_account_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'sepa_mandate_id');
    }

}
