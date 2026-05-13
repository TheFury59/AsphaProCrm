<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HelpArticle extends Model
{
    protected $fillable = [
        'slug', 'title', 'summary', 'body',
        'category', 'audience', 'display_order', 'published',
    ];

    protected function casts(): array
    {
        return [
            'published' => 'boolean',
            'display_order' => 'integer',
        ];
    }
}
