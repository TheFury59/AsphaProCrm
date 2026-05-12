<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalaryDeduction extends Model
{
    protected $fillable = [
        'employee_id',
        'creditor_name',
        'case_number',
        'address',
        'creditor_contact_id',
        'bank_account_id',
        'payment_method',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function creditorContact(): BelongsTo
    {
        return $this->belongsTo(CreditorContact::class, 'creditor_contact_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    public function salaryDeductionDebts(): HasMany
    {
        return $this->hasMany(SalaryDeductionDebt::class, 'salary_deduction_id');
    }

    public function deductionPayments(): HasMany
    {
        return $this->hasMany(DeductionPayment::class, 'salary_deduction_id');
    }

}
