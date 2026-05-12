<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'iban',
        'bic',
        'owner_name',
    ];

    public function salaryDeductions(): HasMany
    {
        return $this->hasMany(SalaryDeduction::class, 'bank_account_id');
    }

    public function sepaMandates(): HasMany
    {
        return $this->hasMany(SepaMandate::class, 'debtor_bank_account_id');
    }

}
