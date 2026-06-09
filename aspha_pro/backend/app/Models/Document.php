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
        // Catégorie libre (ex. 'uploaded_by_employee' pour les uploads self-
        // service depuis l'app mobile). Pure étiquette informative côté UI.
        'category',
        // Public destinataire : 'client' / 'intervenant' / 'encadrement'.
        'audience',
        // Utilisateur qui a uploadé le document. Sert au contrôle d'ownership
        // côté extranet (un intervenant ne peut effacer que SES propres
        // uploads, pas les documents déposés par l'admin RH).
        'uploaded_by_user_id',
        'is_client_visible',
        // Date de fin de validité / renouvellement (saisie manuelle).
        'expiry_date',
    ];

    protected function casts(): array
    {
        return [
            'is_client_visible' => 'boolean',
            // Cast date pur : le JSON renvoie 'YYYY-MM-DD' (pas un datetime
            // ISO), exploitable directement par un <input type="date">.
            'expiry_date' => 'date:Y-m-d',
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
