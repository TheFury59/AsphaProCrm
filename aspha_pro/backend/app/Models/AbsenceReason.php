<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AbsenceReason extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'code',
        'label',
        'acronym',
        'is_paid',
        'is_secondary',
        'status',
        'color',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'is_paid' => 'boolean',
            'is_secondary' => 'boolean',
        ];
    }

    public function employeeAbsences(): HasMany
    {
        return $this->hasMany(EmployeeAbsence::class, 'reason_id');
    }

}
