<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Intervention;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Interventions = table unifiée ponctuelles + récurrentes.
 *
 * - Ponctuelle  : is_recurring=false, start_datetime + end_datetime
 * - Récurrente  : is_recurring=true, recurrence_start_date + frequency + days_of_week + end_*
 *
 * Feed FullCalendar : /api/v1/interventions?from=...&to=...
 * (on retourne d'abord les ponctuelles ; la matérialisation des récurrentes
 * est laissée pour une itération ultérieure — pour le MVP elles seront
 * affichées comme un seul événement "récurrent")
 */
class InterventionController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('planning.view'), 403);

        $perPage = min((int) $request->query('per_page', 100), 200);

        $query = QueryBuilder::for(Intervention::class)
            ->allowedFilters([
                'status', 'is_recurring', 'employee_id', 'client_id', 'mission_id',
                AllowedFilter::callback('from', function ($q, $value) {
                    $q->where(function ($w) use ($value) {
                        $w->where('start_datetime', '>=', $value)
                          ->orWhere('recurrence_start_date', '>=', $value);
                    });
                }),
                AllowedFilter::callback('to', function ($q, $value) {
                    $q->where(function ($w) use ($value) {
                        $w->where('start_datetime', '<=', $value)
                          ->orWhere('recurrence_end_date', '<=', $value)
                          ->orWhereNull('recurrence_end_date');
                    });
                }),
            ])
            ->allowedSorts(['start_datetime', 'created_at', 'status'])
            ->defaultSort('start_datetime')
            ->with(['employee:id,name', 'client:id,code']);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.view'), 403);
        $intervention->load(['employee', 'client', 'mission', 'clientPrestation']);
        return ['data' => $intervention];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('planning.edit'), 403);
        $data = $this->validateIntervention($request);
        $intervention = Intervention::create($data);
        $intervention->load(['employee:id,name', 'client:id,code']);
        return response()->json(['data' => $intervention], 201);
    }

    public function update(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.edit'), 403);
        $data = $this->validateIntervention($request, partial: true);
        $intervention->update($data);
        $intervention->load(['employee:id,name', 'client:id,code']);
        return ['data' => $intervention];
    }

    public function destroy(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.edit'), 403);
        $intervention->delete();
        return response()->noContent();
    }

    private function validateIntervention(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        $opt = $partial ? 'sometimes' : 'nullable';

        return $request->validate([
            'client_id' => [$req, 'exists:clients,id'],
            'mission_id' => ['nullable', 'exists:missions,id'],
            'client_prestation_id' => ['nullable', 'exists:client_prestations,id'],
            'employee_id' => [$opt, 'exists:employees,id'],
            'is_recurring' => [$req, 'boolean'],
            'status' => ['nullable', 'in:a_pourvoir,planifiee,realisee,annulee,draft,terminated'],

            // Ponctuel
            'start_datetime' => ['nullable', 'date'],
            'end_datetime' => ['nullable', 'date', 'after_or_equal:start_datetime'],

            // Récurrent
            'recurrence_start_date' => ['nullable', 'date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'frequency' => ['nullable', 'in:daily,weekly,monthly,yearly'],
            'interval' => ['nullable', 'integer', 'min:1'],
            'days_of_week' => ['nullable', 'string', 'max:32'],
            'end_type' => ['nullable', 'in:never,on_date,after_occurrences'],
            'recurrence_end_date' => ['nullable', 'date'],
            'occurrences_count' => ['nullable', 'integer', 'min:1'],

            // Comments / billing
            'is_paid' => ['nullable', 'boolean'],
            'is_billed' => ['nullable', 'boolean'],
            'bill_client' => ['nullable', 'boolean'],
            'comment' => ['nullable', 'string'],
            'internal_comment' => ['nullable', 'string'],
            'client_comment' => ['nullable', 'string'],
            'employee_comment' => ['nullable', 'string'],

            // Transport
            'transport_mode' => ['nullable', 'string', 'max:32'],
            'vehicle_type' => ['nullable', 'in:personal,company'],
            'is_transport_fixed' => ['nullable', 'boolean'],
            'kms_done' => ['nullable', 'numeric', 'min:0'],
            'kms_paid' => ['nullable', 'numeric', 'min:0'],
        ]);
    }
}
