<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeeEventType extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'label',
        'status',
        'is_payable',
        'impacts_modulation',
        'base_type',
        'exported_to_payroll',
        'export_position',
        'planning_color',
    ];

    protected function casts(): array
    {
        return [
            'is_payable' => 'boolean',
            'impacts_modulation' => 'boolean',
            'exported_to_payroll' => 'boolean',
        ];
    }

    public function employeeEvents(): HasMany
    {
        return $this->hasMany(EmployeeEvent::class, 'event_type_id');
    }

    public function employeeEventRecurrences(): HasMany
    {
        return $this->hasMany(EmployeeEventRecurrence::class, 'event_type_id');
    }

    public function qrCodes(): HasMany
    {
        return $this->hasMany(QrCode::class, 'event_type_id');
    }

}
