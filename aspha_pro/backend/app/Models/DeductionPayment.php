<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeductionPayment extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'salary_deduction_id',
        'amount',
        'paid_at',
        'method',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function salaryDeduction(): BelongsTo
    {
        return $this->belongsTo(SalaryDeduction::class, 'salary_deduction_id');
    }

}
