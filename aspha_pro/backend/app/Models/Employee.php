<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Employee extends Model
{
    use SoftDeletes, LogsActivity;

    public const CLASSIFICATION_NON_CADRE = 'non_cadre';
    public const CLASSIFICATION_CADRE = 'cadre';

    protected $fillable = [
        'user_id',
        'entity_id',
        'owner_user_id',
        'name',
        'avatar_path',
        'phone',
        'email',
        'classification',
        'transport_mode',
        'has_company_vehicle',
        'diploma',
        'job_reference_free',
    ];

    protected $appends = ['avatar_url'];

    protected function casts(): array
    {
        return [
            'has_company_vehicle' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    /**
     * URL absolue de l'avatar (null si non uploadé).
     * Le `?v=` cache-bust force le refresh quand on remplace une photo.
     */
    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) return null;
        $base = \Illuminate\Support\Facades\Storage::disk('public')->url($this->avatar_path);
        $bust = $this->updated_at?->timestamp ?? 0;
        return "{$base}?v={$bust}";
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }

    // === Relations directes ===
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class);
    }

    public function ownerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    // === Contrat actuel (1 actif via is_current) ===
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'employee_id');
    }

    public function currentContract(): HasOne
    {
        return $this->hasOne(Contract::class, 'employee_id')->where('is_current', true);
    }

    // === Compétences (N-N) ===
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'employee_skills', 'employee_id', 'skill_id');
    }

    // === RH ===
    public function absences(): HasMany
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

    // === Planning ===
    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'employee_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(EmployeeEvent::class, 'employee_id');
    }

    public function eventRecurrences(): HasMany
    {
        return $this->hasMany(EmployeeEventRecurrence::class, 'employee_id');
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(Checkin::class, 'employee_id');
    }

    // === Adresses polymorphiques ===
    public function addresses(): MorphMany
    {
        return $this->morphMany(Address::class, 'owner');
    }

    /**
     * Documents rattachés à l'intervenant (`owner` polymorphe).
     * Utilisé entre autres par RequiredDocumentTypesController::checklist().
     * Le `owner_type` stocké est la chaîne courte 'employee' (morph map de
     * AppServiceProvider) — morphMany la résout via getMorphClass().
     */
    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'owner');
    }

    // === Helpers ===
    public function fullName(): string
    {
        return $this->name ?: ($this->user?->name ?? "Intervenant #{$this->id}");
    }
}
