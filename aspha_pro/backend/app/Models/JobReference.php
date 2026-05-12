<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobReference extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'label',
        'classification',
        'level',
        'status',
    ];

}
