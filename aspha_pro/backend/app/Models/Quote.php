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
        'status',
        'pennylane_id',
        'pennylane_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'quote_date' => 'date',
            'validity_date' => 'date',
            'consideration_date' => 'date',
            'deposit_percent' => 'decimal:2',
            'has_pec' => 'boolean',
            'pec_validity_end' => 'date',
            'pec_base_rate' => 'decimal:2',
            'pec_coverage_percent' => 'decimal:2',
            'pec_client_base_rate' => 'decimal:2',
            'pec_detail_surcharges' => 'boolean',
            'pec_ceiling_hours' => 'decimal:2',
            'success_rate' => 'decimal:2',
            'desired_start_date' => 'date',
            'immediate_start' => 'boolean',
            'meeting_done' => 'boolean',
            'has_calendar_surcharges' => 'boolean',
            'has_night_surcharge' => 'boolean',
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

}
