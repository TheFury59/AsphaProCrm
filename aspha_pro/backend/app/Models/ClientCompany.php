<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientCompany extends Model
{
    protected $fillable = [
        'client_id',
        'company_name',
        'legal_form',
        'siret',
        'vat_number',
        'manager_civility',
        'manager_first_name',
        'manager_last_name',
        'manager_role',
        'phone_landline',
        'phone_mobile',
        'primary_email',
        'photo',
        'allow_duplicate',
    ];

    protected function casts(): array
    {
        return [
            'allow_duplicate' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

}
