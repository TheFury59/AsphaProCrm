<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ThirdPartyPayer extends Model
{
    protected $fillable = [
        'name',
        'type',
        'address',
        'phone',
        'email',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'pec_third_party_payer_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'third_party_payer_id');
    }

    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class, 'third_party_payer_id');
    }

}
