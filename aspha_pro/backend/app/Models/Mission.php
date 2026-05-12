<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Mission extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'client_id',
        'quote_id',
        'name',
        'status',
        'no_intervention_no_bill',
        'payment_methods',
        'online_payment_enabled',
        'billing_rhythm',
    ];

    protected function casts(): array
    {
        return [
            'no_intervention_no_bill' => 'boolean',
            'online_payment_enabled' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    public function clientPrestations(): HasMany
    {
        return $this->hasMany(ClientPrestation::class, 'mission_id');
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'mission_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'mission_id');
    }

}
