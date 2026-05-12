<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Entity extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'email',
        'siret',
        'status',
        'modulation_enabled',
        'annualisation_enabled',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'modulation_enabled' => 'boolean',
            'annualisation_enabled' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function entityZones(): HasMany
    {
        return $this->hasMany(EntityZone::class, 'entity_id');
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class, 'entity_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'entity_id');
    }

    public function kmIndemnityRates(): HasMany
    {
        return $this->hasMany(KmIndemnityRate::class, 'entity_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'entity_id');
    }

    public function quoteTypes(): HasMany
    {
        return $this->hasMany(QuoteType::class, 'entity_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'entity_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'entity_id');
    }

    public function entityBankAccounts(): HasMany
    {
        return $this->hasMany(EntityBankAccount::class, 'entity_id');
    }

    public function entitySepaConfig(): HasMany
    {
        return $this->hasMany(EntitySepaConfig::class, 'entity_id');
    }

    public function sepaMandates(): HasMany
    {
        return $this->hasMany(SepaMandate::class, 'entity_id');
    }

    public function sepaOrders(): HasMany
    {
        return $this->hasMany(SepaOrder::class, 'entity_id');
    }

    public function billingCycles(): HasMany
    {
        return $this->hasMany(BillingCycle::class, 'entity_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'entity_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'entity_id');
    }

    public function messageThreads(): HasMany
    {
        return $this->hasMany(MessageThread::class, 'entity_id');
    }

    public function stockProducts(): HasMany
    {
        return $this->hasMany(StockProduct::class, 'entity_id');
    }

    public function stockInventories(): HasMany
    {
        return $this->hasMany(StockInventory::class, 'entity_id');
    }

}
