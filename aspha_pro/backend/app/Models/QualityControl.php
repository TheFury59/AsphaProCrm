<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QualityControl extends Model
{
    protected $fillable = [
        'client_id',
        'controlled_by',
        'control_date',
        'result',
        'comment',
        'next_control_date',
    ];

    protected function casts(): array
    {
        return [
            'control_date' => 'datetime',
            'next_control_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function controlledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'controlled_by');
    }

}
