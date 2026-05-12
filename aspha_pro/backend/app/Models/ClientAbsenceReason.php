<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientAbsenceReason extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'label',
        'status',
        'allow_indefinite_duration',
    ];

    protected function casts(): array
    {
        return [
            'allow_indefinite_duration' => 'boolean',
        ];
    }

    public function clientAbsences(): HasMany
    {
        return $this->hasMany(ClientAbsence::class, 'reason_id');
    }

}
