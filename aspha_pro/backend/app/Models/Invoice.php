<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Invoice extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'reference',
        'type',
        'client_id',
        'mission_id',
        'third_party_payer_id',
        'entity_id',
        'billing_cycle_id',
        'intervention_address_id',
        'payment_mode',
        'payment_status',
        'send_mode',
        'invoice_date',
        'due_date',
        'total',
        'needs_recalculation',
        'comment',
        'status',
        'e_invoice_format',
        'e_invoice_sent_at',
        'e_invoice_status',
        'pennylane_id',
        'pennylane_synced_at',
    ];

    protected function casts(): array
    {
        return [
            // 2026-06-24 — format explicite YYYY-MM-DD pour éviter les ISO
            // datetime parasites (T22:00:00.000000Z) dans la liste front et
            // l'<input type=date>. Même fix que Quote/ClientPrestation —
            // cf. LRN 2026-05-21.
            'invoice_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'total' => 'decimal:2',
            'needs_recalculation' => 'boolean',
            'e_invoice_sent_at' => 'datetime',
            'pennylane_synced_at' => 'datetime',
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

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class, 'mission_id');
    }

    public function thirdPartyPayer(): BelongsTo
    {
        return $this->belongsTo(ThirdPartyPayer::class, 'third_party_payer_id');
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function billingCycle(): BelongsTo
    {
        return $this->belongsTo(BillingCycle::class, 'billing_cycle_id');
    }

    public function interventionAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'intervention_address_id');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id');
    }

    public function reglementInvoiceLines(): HasMany
    {
        return $this->hasMany(ReglementInvoiceLine::class, 'invoice_id');
    }

}
