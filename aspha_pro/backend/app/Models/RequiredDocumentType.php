<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequiredDocumentType extends Model
{
    protected $fillable = [
        'label', 'category_match', 'applies_to',
        'is_mandatory', 'description', 'display_order',
    ];

    protected function casts(): array
    {
        return [
            'is_mandatory' => 'boolean',
            'display_order' => 'integer',
        ];
    }
}
