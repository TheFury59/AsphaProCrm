<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Employee extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'user_id',
        'entity_id',
        'owner_user_id',
        'name',
        'phone',
        'classification',
        'transport_mode',
        'has_company_vehicle',
        'diploma',
        'job_reference_free',
    ];

    protected function casts(): array
    {
        return [
            'has_company_vehicle' => 'boolean',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'employee_id');
    }

    public function employeeSkills(): HasMany
    {
        return $this->hasMany(EmployeeSkill::class, 'employee_id');
    }

    public function clientEmployeeHistory(): HasMany
    {
        return $this->hasMany(ClientEmployeeHistory::class, 'employee_id');
    }

    public function employeeAbsences(): HasMany
    {
        return $this->hasMany(EmployeeAbsence::class, 'employee_id');
    }

    public function trainings(): HasMany
    {
        return $this->hasMany(Training::class, 'employee_id');
    }

    public function salaryDeductions(): HasMany
    {
        return $this->hasMany(SalaryDeduction::class, 'employee_id');
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'employee_id');
    }

    public function recurrenceAssignments(): HasMany
    {
        return $this->hasMany(RecurrenceAssignment::class, 'employee_id');
    }

    public function matchingRequests(): HasMany
    {
        return $this->hasMany(MatchingRequest::class, 'selected_employee_id');
    }

    public function telemanagementLogs(): HasMany
    {
        return $this->hasMany(TelemanagementLog::class, 'employee_id');
    }

    public function employeeEvents(): HasMany
    {
        return $this->hasMany(EmployeeEvent::class, 'employee_id');
    }

    public function employeeEventRecurrences(): HasMany
    {
        return $this->hasMany(EmployeeEventRecurrence::class, 'employee_id');
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(Checkin::class, 'employee_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'employee_id');
    }

}
