<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'code', 'description', 'default_hourly_rate',
        'default_duration_minutes', 'color', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'default_hourly_rate' => 'decimal:2',
        ];
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ServiceAssignment::class);
    }
}
