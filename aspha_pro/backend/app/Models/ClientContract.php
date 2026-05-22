<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Contrat côté CLIENT (tâche B4).
 *
 * Entité distincte du modèle `Contract` (RH / intervenants) : un contrat
 * client est volontairement simple (référence, type, dates, engagement,
 * facturation). Aucun polymorphisme — table dédiée `client_contracts`.
 */
class ClientContract extends Model
{
    use LogsActivity;

    protected $fillable = [
        'client_id',
        'reference',
        'type',
        'start_date',
        'end_date',
        'commitment_duration',
        'billing_rhythm',
        'tacit_renewal',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            // Format explicite `Y-m-d` : un cast `date` nu sérialise un
            // datetime ISO complet → l'<input type=date> du front ne peut pas
            // l'afficher et la date dérive de -1j à chaque aller-retour
            // (tz Europe/Paris). Cf. lessons.md 2026-05-21.
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'tacit_renewal' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
