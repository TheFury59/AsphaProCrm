<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Intervention;
use App\Services\InterventionExpander;
use Carbon\Carbon;
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

    /**
     * GET /api/v1/interventions/calendar?from=...&to=...&employee_id=...&client_id=...
     *
     * Feed FullCalendar : retourne les ponctuelles + les occurrences virtuelles
     * des récurrentes dans la fenêtre demandée.
     */
    public function calendar(Request $request, InterventionExpander $expander)
    {
        abort_unless($request->user()?->can('planning.view'), 403);

        $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'integer'],
            'client_id' => ['nullable', 'integer'],
        ]);

        $from = Carbon::parse($request->query('from'))->startOfDay();
        $to = Carbon::parse($request->query('to'))->endOfDay();

        // Eager-loads CRITIQUES : InterventionExpander utilise relationLoaded()
        // pour résoudre adresse + contact + clés du client. Sans ces eager-loads,
        // le tooltip affiche "Adresse non renseignée" même si le client en a
        // (cf. session du 2026-05-18 19:00).
        $query = Intervention::query()
            ->with([
                'employee:id,name',
                'client:id,code',
                'client.company:id,client_id,company_name,phone_mobile,primary_email,manager_first_name,manager_last_name,photo,updated_at',
                'client.addresses',
                'client.contacts',
                'client.keys:id,client_id,label,current_holder',
                'clientPrestation:id,label,product_id,custom_price,base_price,billing_type,pricing_type',
                'clientPrestation.product:id,name,price,default_duration_minutes',
                'checkins:id,intervention_id,checkin_time,checkout_time',
                'key:id,client_id,label,current_holder',
                'address',
                'contact',
            ])
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('start_datetime', [$from, $to]);
                $q->orWhere(function ($q2) use ($from, $to) {
                    $q2->where('is_recurring', true)
                       ->where(function ($q3) use ($to) {
                           $q3->whereNull('recurrence_start_date')
                              ->orWhere('recurrence_start_date', '<=', $to);
                       })
                       ->where(function ($q3) use ($from) {
                           $q3->whereNull('recurrence_end_date')
                              ->orWhere('recurrence_end_date', '>=', $from);
                       });
                });
            });

        if ($employeeId = $request->integer('employee_id')) {
            $query->where('employee_id', $employeeId);
        }
        if ($clientId = $request->integer('client_id')) {
            $query->where('client_id', $clientId);
        }

        $events = $expander->expandWindow($from, $to, $query->get());

        return ['data' => $events->values()];
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
        // La notification est émise par InterventionObserver::created (DRY).
        $intervention = Intervention::create($data);
        $intervention->load(['employee:id,name', 'client:id,code']);
        return response()->json(['data' => $intervention], 201);
    }

    public function update(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.edit'), 403);
        $data = $this->validateIntervention($request, partial: true);
        $intervention->update($data);
        $intervention->load([
            'employee:id,name',
            'client:id,code',
            'key:id,label,current_holder',
            'address',
            'contact',
        ]);
        return ['data' => $intervention];
    }

    /**
     * POST /api/v1/interventions/{intervention}/exceptions
     *
     * Crée une exception sur une récurrence : remplace une occurrence virtuelle
     * par une nouvelle intervention liée (parent_id + is_exception + exception_date).
     * Permet ensuite de la déplacer, modifier le statut, etc. sans toucher à la série.
     */
    public function createException(Request $request, Intervention $intervention)
    {
        abort_unless($request->user()?->can('planning.edit'), 403);
        abort_unless($intervention->is_recurring, 422, "Seules les récurrences peuvent avoir des exceptions");

        $data = $request->validate([
            'exception_date' => ['required', 'date'],
            'start_datetime' => ['required', 'date'],
            // after_or_equal car on peut très bien avoir un RDV qui dure 0 min (rare mais possible)
            'end_datetime' => ['required', 'date', 'after_or_equal:start_datetime'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'status' => ['nullable', 'in:a_pourvoir,planifiee,realisee,annulee,draft,terminated'],
            'comment' => ['nullable', 'string'],
        ]);

        // Empêcher les doublons d'exception sur la même date
        $existing = Intervention::where('parent_id', $intervention->id)
            ->where('is_exception', true)
            ->whereDate('exception_date', $data['exception_date'])
            ->first();
        if ($existing) {
            return response()->json([
                'message' => 'Une exception existe déjà pour cette date',
                'data' => $existing,
            ], 409);
        }

        $exception = Intervention::create([
            'client_id' => $intervention->client_id,
            'mission_id' => $intervention->mission_id,
            'client_prestation_id' => $intervention->client_prestation_id,
            'employee_id' => $data['employee_id'] ?? $intervention->employee_id,
            'is_recurring' => false,
            'is_exception' => true,
            'parent_id' => $intervention->id,
            'exception_date' => $data['exception_date'],
            'start_datetime' => $data['start_datetime'],
            'end_datetime' => $data['end_datetime'],
            'status' => $data['status'] ?? 'planifiee',
            'comment' => $data['comment'] ?? null,
        ]);

        $exception->load(['employee:id,name', 'client:id,code']);
        return response()->json(['data' => $exception], 201);
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
            'client_id' => [$req, 'nullable', 'exists:clients,id'],
            'mission_id' => ['nullable', 'exists:missions,id'],
            'client_prestation_id' => ['nullable', 'exists:client_prestations,id'],
            'key_id' => ['nullable', 'exists:keys,id'],
            'address_id' => ['nullable', 'exists:addresses,id'],
            'contact_id' => ['nullable', 'exists:client_contacts,id'],
            // `nullable` IMPÉRATIF : sans lui, envoyer `employee_id: null` (= "À pourvoir")
            // fait échouer la règle `exists` → validation.exists
            'employee_id' => [$opt, 'nullable', 'exists:employees,id'],
            'replacement_employee_id' => ['nullable', 'exists:employees,id'],
            'is_recurring' => [$opt, 'boolean'],
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
