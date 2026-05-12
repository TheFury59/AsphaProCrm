<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Client extends Model
{
    use SoftDeletes, LogsActivity;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'code',
        'status',
        'entity_id',
        'owner_user_id',
        'print_intervention_detail',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }

    // === Relations 1-1 ===
    public function company(): HasOne
    {
        return $this->hasOne(ClientCompany::class, 'client_id');
    }

    public function billingContact(): HasOne
    {
        return $this->hasOne(BillingContact::class, 'client_id');
    }

    // === Relations N ===
    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class);
    }

    public function ownerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class, 'client_id');
    }

    public function relatedContacts(): HasMany
    {
        return $this->hasMany(RelatedContact::class, 'client_id');
    }

    public function absences(): HasMany
    {
        return $this->hasMany(ClientAbsence::class, 'client_id');
    }

    public function missions(): HasMany
    {
        return $this->hasMany(Mission::class, 'client_id');
    }

    public function prestations(): HasMany
    {
        return $this->hasMany(ClientPrestation::class, 'client_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'client_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'client_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'client_id');
    }

    public function keys(): HasMany
    {
        return $this->hasMany(Key::class, 'client_id');
    }

    // === Adresses polymorphiques ===
    public function addresses(): MorphMany
    {
        return $this->morphMany(Address::class, 'owner');
    }

    // === Helpers ===
    public function displayName(): string
    {
        return $this->company?->company_name ?? "Client #{$this->id}";
    }
}
