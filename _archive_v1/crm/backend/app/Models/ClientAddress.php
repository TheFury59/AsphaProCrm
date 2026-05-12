<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClientAddress extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'client_id', 'label', 'address_line1', 'address_line2', 'postal_code',
        'city', 'country', 'geo_lat', 'geo_lng', 'access_notes', 'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'geo_lat' => 'decimal:7',
            'geo_lng' => 'decimal:7',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
