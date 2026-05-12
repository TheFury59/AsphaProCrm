<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Reglement extends Model
{
    use LogsActivity;

    protected $fillable = [
        'reference',
        'type',
        'status',
        'is_non_deductible',
        'client_id',
        'third_party_payer_id',
        'employee_id',
        'supplier_id',
        'payment_method',
        'cesu_count',
        'cesu_unit_price',
        'sepa_order_id',
        'sepa_mandate_id',
        'amount',
        'ventilation_status',
        'operation_date',
        'value_date',
        'entity_id',
        'entity_bank_account_id',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'is_non_deductible' => 'boolean',
            'cesu_unit_price' => 'decimal:2',
            'amount' => 'decimal:2',
            'operation_date' => 'date',
            'value_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function thirdPartyPayer(): BelongsTo
    {
        return $this->belongsTo(ThirdPartyPayer::class, 'third_party_payer_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function sepaOrder(): BelongsTo
    {
        return $this->belongsTo(SepaOrder::class, 'sepa_order_id');
    }

    public function sepaMandate(): BelongsTo
    {
        return $this->belongsTo(SepaMandate::class, 'sepa_mandate_id');
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function entityBankAccount(): BelongsTo
    {
        return $this->belongsTo(EntityBankAccount::class, 'entity_bank_account_id');
    }

    public function reglementInvoiceLines(): HasMany
    {
        return $this->hasMany(ReglementInvoiceLine::class, 'reglement_id');
    }

}
