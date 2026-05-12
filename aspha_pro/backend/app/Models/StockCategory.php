<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockCategory extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'label',
        'status',
    ];

    public function stockProducts(): HasMany
    {
        return $this->hasMany(StockProduct::class, 'category_id');
    }

}
