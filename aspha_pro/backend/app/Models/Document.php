<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Document extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'owner_type',
        'owner_id',
        'file_path',
        'label',
        'document_type',
        'is_client_visible',
    ];

    protected function casts(): array
    {
        return [
            'is_client_visible' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }

    public function electronicSignatures(): HasMany
    {
        return $this->hasMany(ElectronicSignature::class, 'document_id');
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

}
