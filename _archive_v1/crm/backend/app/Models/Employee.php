<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_ON_LEAVE = 'on_leave';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'user_id', 'site_id', 'first_name', 'last_name', 'phone', 'mobile',
        'birthdate', 'address_line1', 'address_line2', 'postal_code', 'city',
        'country', 'geo_lat', 'geo_lng', 'hire_date', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'birthdate' => 'date',
            'hire_date' => 'date',
            'geo_lat' => 'decimal:7',
            'geo_lng' => 'decimal:7',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(EmployeeContract::class);
    }

    public function currentContract(): HasOne
    {
        return $this->hasOne(EmployeeContract::class)->where('is_current', true);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class);
    }

    public function unavailabilities(): HasMany
    {
        return $this->hasMany(Unavailability::class);
    }

    public function fullName(): string
    {
        return trim($this->first_name . ' ' . $this->last_name);
    }
}
