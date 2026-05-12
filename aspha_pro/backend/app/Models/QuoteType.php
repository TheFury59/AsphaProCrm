<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuoteType extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'entity_id',
        'label',
        'modality',
        'nature',
        'billing_mode',
        'quote_calculation',
        'commitment_duration',
        'billing_rhythm',
        'deposit_percent',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'deposit_percent' => 'decimal:2',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'quote_type_id');
    }

}
