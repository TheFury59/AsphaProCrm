<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractBlockedSlot extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'contract_id',
        'day_of_week',
        'slot_start',
        'slot_end',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

}
