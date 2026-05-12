<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Client extends Model
{
    use SoftDeletes, LogsActivity;

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
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function ownerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function clientCompanies(): HasMany
    {
        return $this->hasMany(ClientCompany::class, 'client_id');
    }

    public function billingContacts(): HasMany
    {
        return $this->hasMany(BillingContact::class, 'client_id');
    }

    public function clientContacts(): HasMany
    {
        return $this->hasMany(ClientContact::class, 'client_id');
    }

    public function relatedContacts(): HasMany
    {
        return $this->hasMany(RelatedContact::class, 'client_id');
    }

    public function clientAbsences(): HasMany
    {
        return $this->hasMany(ClientAbsence::class, 'client_id');
    }

    public function clientEmployeeHistory(): HasMany
    {
        return $this->hasMany(ClientEmployeeHistory::class, 'client_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'client_id');
    }

    public function missions(): HasMany
    {
        return $this->hasMany(Mission::class, 'client_id');
    }

    public function clientPrestations(): HasMany
    {
        return $this->hasMany(ClientPrestation::class, 'client_id');
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'client_id');
    }

    public function clientEvents(): HasMany
    {
        return $this->hasMany(ClientEvent::class, 'client_id');
    }

    public function clientEventRecurrences(): HasMany
    {
        return $this->hasMany(ClientEventRecurrence::class, 'client_id');
    }

    public function telemanagementLogs(): HasMany
    {
        return $this->hasMany(TelemanagementLog::class, 'client_id');
    }

    public function sepaMandates(): HasMany
    {
        return $this->hasMany(SepaMandate::class, 'client_id');
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

    public function clientRequests(): HasMany
    {
        return $this->hasMany(ClientRequest::class, 'client_id');
    }

    public function consumableReorders(): HasMany
    {
        return $this->hasMany(ConsumableReorder::class, 'client_id');
    }

    public function qualityControls(): HasMany
    {
        return $this->hasMany(QualityControl::class, 'client_id');
    }

}
