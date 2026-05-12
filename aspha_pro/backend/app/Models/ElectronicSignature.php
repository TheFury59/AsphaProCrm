<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ElectronicSignature extends Model
{
    use LogsActivity;

    protected $fillable = [
        'document_id',
        'signer_type',
        'signer_id',
        'signed_at',
        'signature_token',
        'ip_address',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'signed_at' => 'datetime',
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

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }

}
