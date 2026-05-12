<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CreditorContact extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'first_name',
        'last_name',
        'type',
        'office_phone',
        'mobile_phone',
        'home_phone',
        'email',
        'newsletter_subscribed',
        'postal_code',
        'city',
        'company',
        'role',
    ];

    protected function casts(): array
    {
        return [
            'newsletter_subscribed' => 'boolean',
        ];
    }

    public function salaryDeductions(): HasMany
    {
        return $this->hasMany(SalaryDeduction::class, 'creditor_contact_id');
    }

}
