<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClientPrestation extends Model
{
    use SoftDeletes;

    public $timestamps = false;

    protected $fillable = [
        'client_id',
        'mission_id',
        'product_id',
        'quote_id',
        'label',
        'duration_minutes', // 2026-05-22 (C4) — durée standard saisie sur la prestation
        'start_date',
        'end_date',
        'billing_type',
        'pricing_type',
        'custom_price',
        'base_price',
        'no_intervention_no_bill',
        // Nature + récurrence (refonte 2026-05-21) : la nature régulier/ponctuel
        // est portée par la prestation contractualisée, pas le catalogue.
        'nature',
        'recurrence_frequency',
        'recurrence_interval',
        'recurrence_days_of_week',
        'recurrence_start_time',
        'recurrence_end_time',
        'recurrence_end_type',
        'recurrence_occurrences_count',
        // Intervenant par défaut des RDV générés pour cette prestation récurrente
        // (refonte 2026-05-21). Nullable : si absent, les RDV restent 'a_pourvoir'.
        'default_employee_id',
    ];

    protected function casts(): array
    {
        return [
            // Format `date:Y-m-d` (et non `date` seul) : sans le format, Eloquent
            // sérialise en JSON un datetime ISO complet (`2026-05-21T00:00:00Z`)
            // que le front ré-injecte tel quel — ce qui (1) vide le <input date>
            // et (2) fait dériver la date de -1 jour à chaque aller-retour en
            // timezone Europe/Paris. Le format force un `YYYY-MM-DD` propre.
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'custom_price' => 'decimal:2',
            'base_price' => 'decimal:2',
            'no_intervention_no_bill' => 'boolean',
            'duration_minutes' => 'integer',
            'recurrence_interval' => 'integer',
            'recurrence_occurrences_count' => 'integer',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class, 'mission_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    /**
     * Intervenant par défaut choisi pour les RDV générés de cette prestation
     * récurrente (refonte 2026-05-21). Nullable : si absent, les RDV restent
     * « à pourvoir ».
     */
    public function defaultEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'default_employee_id');
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class, 'client_prestation_id');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'client_prestation_id');
    }

}
