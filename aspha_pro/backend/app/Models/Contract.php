<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Contract extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'employee_id',
        'entity_id',
        'is_current',
        'position',
        'intervention_zone',
        'contract_type',
        'activity_modality',
        'is_cdi_inclusion',
        'cdd_reason',
        'cdd_imprecise_term',
        'end_date',
        'precarity_payment',
        'tutor_name',
        'is_mandatory_internship',
        'start_date',
        'trial_period',
        'trial_start',
        'trial_end',
        'trial_renewed',
        'first_intervention_date',
        'sent_date',
        'signed_date',
        'dpae_date',
        'is_non_salarie',
        'medical_visit_address_type',
        'medical_visit_address_id',
        'work_time_type',
        'monthly_duration',
        'weekly_duration',
        'pay_mode',
        'monthly_salary',
        'hourly_rate',
        'km_rate_inter_vacation',
        'km_rate_intervention',
        'qualification',
        'employee_status',
        'seniority_date',
        'profession_code',
        'socio_professional_category',
        'conventional_categorical_status',
        'conventional_classification',
        'non_compete_clause',
        'is_accre_beneficiary',
        'is_mandatory_internship_school',
        'geographic_zone',
        'working_days_mask',
        'is_night_worker',
        'is_office_staff',
        'subject_to_mobility_contribution',
        'public_holidays_worked',
        'real_payment',
        'multiple_employers',
        'rural_territory_exemption',
        'part_time_full_contribution',
        'cp_payment_mode',
        'cp_days_current_month',
        'population_code',
        'prudhommal_code',
        'penibility_exposure_mask',
        'health_insurance',
        'health_insurance_reason',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'is_current' => 'boolean',
            'is_cdi_inclusion' => 'boolean',
            'cdd_imprecise_term' => 'boolean',
            'end_date' => 'date',
            'precarity_payment' => 'boolean',
            'is_mandatory_internship' => 'boolean',
            'start_date' => 'date',
            'trial_period' => 'boolean',
            'trial_start' => 'date',
            'trial_end' => 'date',
            'trial_renewed' => 'boolean',
            'first_intervention_date' => 'date',
            'sent_date' => 'date',
            'signed_date' => 'date',
            'dpae_date' => 'date',
            'is_non_salarie' => 'boolean',
            'monthly_duration' => 'float',
            'weekly_duration' => 'float',
            'monthly_salary' => 'decimal:2',
            'hourly_rate' => 'decimal:2',
            'km_rate_inter_vacation' => 'decimal:2',
            'km_rate_intervention' => 'decimal:2',
            'seniority_date' => 'date',
            'non_compete_clause' => 'boolean',
            'is_accre_beneficiary' => 'boolean',
            'is_mandatory_internship_school' => 'boolean',
            'is_night_worker' => 'boolean',
            'is_office_staff' => 'boolean',
            'subject_to_mobility_contribution' => 'boolean',
            'real_payment' => 'boolean',
            'multiple_employers' => 'boolean',
            'rural_territory_exemption' => 'boolean',
            'part_time_full_contribution' => 'boolean',
            'cp_days_current_month' => 'decimal:2',
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

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function medicalVisitAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'medical_visit_address_id');
    }

    public function contractBlockedSlots(): HasMany
    {
        return $this->hasMany(ContractBlockedSlot::class, 'contract_id');
    }

    public function contractSurchargeOverrides(): HasMany
    {
        return $this->hasMany(ContractSurchargeOverride::class, 'contract_id');
    }

    public function employeeEvents(): HasMany
    {
        return $this->hasMany(EmployeeEvent::class, 'contract_id');
    }

    public function employeeEventRecurrences(): HasMany
    {
        return $this->hasMany(EmployeeEventRecurrence::class, 'contract_id');
    }

}
