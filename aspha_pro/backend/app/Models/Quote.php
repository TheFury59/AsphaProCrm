<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Quote extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'reference',
        'total',
        'client_id',
        'quote_type_id',
        'address_id',
        'entity_id',
        'owner_user_id',
        'nature',
        'quote_date',
        'validity_date',
        'billing_mode',
        'quote_calculation',
        'consideration_date',
        'commitment_duration',
        'billing_rhythm',
        'deposit_percent',
        'has_pec',
        'pec_third_party_payer_id',
        'pec_file_number',
        'pec_status',
        'pec_mode',
        'pec_billing_rhythm',
        'pec_validity_end',
        'pec_base_rate',
        'pec_coverage_percent',
        'pec_ceiling_scope',
        'pec_client_base_rate',
        'pec_beyond_ceiling',
        'pec_detail_surcharges',
        'pec_ceiling_type',
        'pec_ceiling_hours',
        'success_rate',
        'desired_start_date',
        'immediate_start',
        'meeting_done',
        'has_calendar_surcharges',
        'has_night_surcharge',
        'comment',
        'internal_notes', // 2026-06-24 — notes admin, jamais sur le PDF client
        'status',
        'invoice_id', // audit 2026-05-19 — anti double-conversion devis→facture
        'pennylane_id',
        'pennylane_synced_at',
    ];

    protected function casts(): array
    {
        return [
            // 2026-06-24 — format explicite YYYY-MM-DD pour éviter les ISO
            // datetime parasites (T22:00:00Z) côté frontend. Même règle que
            // ClientPrestation/Intervention — cf. LRN 2026-05-21.
            'quote_date' => 'date:Y-m-d',
            'validity_date' => 'date:Y-m-d',
            'consideration_date' => 'date:Y-m-d',
            'deposit_percent' => 'decimal:2',
            'has_pec' => 'boolean',
            'pec_validity_end' => 'date:Y-m-d',
            'pec_base_rate' => 'decimal:2',
            'pec_coverage_percent' => 'decimal:2',
            'pec_client_base_rate' => 'decimal:2',
            'pec_detail_surcharges' => 'boolean',
            'pec_ceiling_hours' => 'decimal:2',
            'success_rate' => 'decimal:2',
            'desired_start_date' => 'date:Y-m-d',
            'immediate_start' => 'boolean',
            'meeting_done' => 'boolean',
            'has_calendar_surcharges' => 'boolean',
            'has_night_surcharge' => 'boolean',
            'pennylane_synced_at' => 'datetime',
            'created_at' => 'datetime',
            'total' => 'decimal:2',
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

    public function quoteType(): BelongsTo
    {
        return $this->belongsTo(QuoteType::class, 'quote_type_id');
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'address_id');
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function ownerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function pecThirdPartyPayer(): BelongsTo
    {
        return $this->belongsTo(ThirdPartyPayer::class, 'pec_third_party_payer_id');
    }

    public function quoteSurchargeRules(): HasMany
    {
        return $this->hasMany(QuoteSurchargeRule::class, 'quote_id');
    }

    public function missions(): HasMany
    {
        return $this->hasMany(Mission::class, 'quote_id');
    }

    public function clientPrestations(): HasMany
    {
        return $this->hasMany(ClientPrestation::class, 'quote_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuoteItem::class, 'quote_id')->orderBy('order');
    }

    // audit 2026-05-19 — facture issue de la conversion (anti double-conversion)
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

}
