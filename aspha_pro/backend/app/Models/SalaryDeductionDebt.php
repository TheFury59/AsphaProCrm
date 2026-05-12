<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryDeductionDebt extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'salary_deduction_id',
        'type',
        'is_alimony_calculated',
        'start_date',
        'end_date',
        'priority',
        'total_due',
        'partial_release_amount',
        'amount_paid',
        'balance',
        'full_release_date',
    ];

    protected function casts(): array
    {
        return [
            'is_alimony_calculated' => 'boolean',
            'start_date' => 'date',
            'end_date' => 'date',
            'total_due' => 'decimal:2',
            'partial_release_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'balance' => 'decimal:2',
            'full_release_date' => 'date',
        ];
    }

    public function salaryDeduction(): BelongsTo
    {
        return $this->belongsTo(SalaryDeduction::class, 'salary_deduction_id');
    }

}
