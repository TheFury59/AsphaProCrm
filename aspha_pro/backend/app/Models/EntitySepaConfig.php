<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntitySepaConfig extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'entity_id',
        'bank_norm',
        'show_contract_info_on_mandate',
        'show_entity_address_on_mandate',
        'omit_bic',
        'use_smnda_on_bank_change',
        'has_intermediate_creditor',
        'intermediate_creditor_name',
        'intermediate_creditor_iban',
        'use_due_date_as_operation_date',
        'use_ddfip_format',
    ];

    protected function casts(): array
    {
        return [
            'show_contract_info_on_mandate' => 'boolean',
            'show_entity_address_on_mandate' => 'boolean',
            'omit_bic' => 'boolean',
            'use_smnda_on_bank_change' => 'boolean',
            'has_intermediate_creditor' => 'boolean',
            'use_due_date_as_operation_date' => 'boolean',
            'use_ddfip_format' => 'boolean',
        ];
    }

    public function entity(): BelongsTo
    {
        return $this->belongsTo(Entity::class, 'entity_id');
    }

}
