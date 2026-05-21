<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Intervention extends Model
{
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'client_id',
        'mission_id',
        'client_prestation_id',
        'key_id',
        'address_id',
        'contact_id',
        'employee_id',
        'is_recurring',
        'status',
        'is_group',
        'start_datetime',
        'end_datetime',
        'recurrence_start_date',
        'start_time',
        'end_time',
        'frequency',
        'interval',
        'days_of_week',
        'exclude_holidays',
        'exclude_school_holidays',
        'end_type',
        'recurrence_end_date',
        'occurrences_count',
        'next_intervention_id',
        'parent_id',
        'is_exception',
        'exception_date',
        'replacement_employee_id',
        'replacement_reason',
        'is_paid',
        'is_billed',
        'bill_client',
        'adjustment_of_id',
        'comment',
        'internal_comment',
        'client_comment',
        'employee_comment',
        'transport_mode',
        'vehicle_type',
        'is_transport_fixed',
        'kms_done',
        'kms_paid',
    ];

    protected function casts(): array
    {
        return [
            'is_recurring' => 'boolean',
            'is_group' => 'boolean',
            'start_datetime' => 'datetime',
            'end_datetime' => 'datetime',
            // Format `date:Y-m-d` : sans format, Eloquent sérialise un datetime
            // ISO complet que les <input type=date> du planning ne peuvent pas
            // afficher et qui dérive de -1 jour à chaque aller-retour (tz Paris).
            'recurrence_start_date' => 'date:Y-m-d',
            'exclude_holidays' => 'boolean',
            'exclude_school_holidays' => 'boolean',
            'recurrence_end_date' => 'date:Y-m-d',
            'is_exception' => 'boolean',
            'exception_date' => 'date',
            'is_paid' => 'boolean',
            'is_billed' => 'boolean',
            'bill_client' => 'boolean',
            'is_transport_fixed' => 'boolean',
            'kms_done' => 'float',
            'kms_paid' => 'float',
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

    /**
     * Défaut métier : on présume "à facturer" et "à payer" pour chaque RDV
     * planifié, sauf décision contraire de l'admin (case décochable dans l'UI).
     */
    protected static function booted(): void
    {
        static::creating(function (Intervention $iv) {
            if ($iv->bill_client === null) $iv->bill_client = true;
            if ($iv->is_paid === null) $iv->is_paid = true;
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class, 'mission_id');
    }

    public function clientPrestation(): BelongsTo
    {
        return $this->belongsTo(ClientPrestation::class, 'client_prestation_id');
    }

    /**
     * Clé du client utilisée pour cette intervention (nullable — la plupart
     * des RDV n'en ont pas besoin).
     */
    public function key(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Key::class, 'key_id');
    }

    /**
     * Adresse spécifique du client où se déroule cette intervention (utile
     * quand le client a plusieurs adresses : siège, intervention secondaire…).
     */
    public function address(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Address::class, 'address_id');
    }

    /**
     * Contact spécifique pour cette intervention (joint plutôt que le contact
     * entreprise par défaut — pour ex. demander un proche, le tuteur, etc.).
     */
    public function contact(): BelongsTo
    {
        // ClientContact, pas Contact : la table s'appelle `client_contacts`
        // et le model correspondant est App\Models\ClientContact (cf. fix FK
        // du 2026-05-18 — même bug de nommage propagé sur la relation).
        return $this->belongsTo(\App\Models\ClientContact::class, 'contact_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function nextIntervention(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'next_intervention_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'parent_id');
    }

    public function replacementEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'replacement_employee_id');
    }

    public function adjustmentOf(): BelongsTo
    {
        return $this->belongsTo(Intervention::class, 'adjustment_of_id');
    }

    public function recurrenceAssignments(): HasMany
    {
        return $this->hasMany(RecurrenceAssignment::class, 'recurrence_id');
    }

    public function matchingRequests(): HasMany
    {
        return $this->hasMany(MatchingRequest::class, 'recurrence_id');
    }

    public function telemanagementLogs(): HasMany
    {
        return $this->hasMany(TelemanagementLog::class, 'intervention_id');
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(Checkin::class, 'intervention_id');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'intervention_id');
    }

}
