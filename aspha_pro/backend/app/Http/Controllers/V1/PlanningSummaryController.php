<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Intervention;
use App\Services\InterventionExpander;
use App\Services\TripPlannerService;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Endpoints d'agrégation pour la sidebar / barre du planning.
 *
 *  - GET /planning/contract-summary : par intervenant, sur une fenêtre, retourne
 *    heures contrat, heures planifiées, heures dispo, % remplissage
 *
 *  - GET /planning/long-absences : absences ≥ seuil paramétrable, dans la fenêtre
 *    (pour le bandeau sticky du calendrier)
 */
class PlanningSummaryController extends Controller
{
    public function contractSummary(Request $request, InterventionExpander $expander)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
            'employee_id' => ['nullable', 'integer'],
        ]);

        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();
        $daysInWindow = $from->diffInDays($to) + 1;
        $weeksInWindow = $daysInWindow / 7;

        $employees = Employee::query()
            ->when(! empty($data['employee_id']), fn ($q) => $q->where('id', $data['employee_id']))
            ->where('status', 'active')
            ->with(['currentContract:id,employee_id,weekly_duration,monthly_duration,position'])
            ->get();

        // Expand toutes les interventions sur la fenêtre (réutilise le service récurrence)
        $events = $expander->expandWindow($from, $to);
        $eventsByEmployee = $events->groupBy('employee.id');

        $summary = $employees->map(function (Employee $e) use ($eventsByEmployee, $weeksInWindow) {
            $contractHours = (float) ($e->currentContract?->weekly_duration ?? 0);
            $contractWindow = round($contractHours * $weeksInWindow, 1);

            // Heures planifiées (somme durées events non annulés)
            $events = $eventsByEmployee->get($e->id, collect());
            $plannedMinutes = $events
                ->filter(fn ($ev) => ($ev['status'] ?? null) !== 'annulee')
                ->sum(function ($ev) {
                    $start = Carbon::parse($ev['start_datetime']);
                    $end = Carbon::parse($ev['end_datetime']);
                    return $start->diffInMinutes($end);
                });
            $plannedHours = round($plannedMinutes / 60, 1);

            $available = max(0, round($contractWindow - $plannedHours, 1));
            $fillRate = $contractWindow > 0 ? round(($plannedHours / $contractWindow) * 100) : 0;

            return [
                'employee_id' => $e->id,
                'employee_name' => $e->name,
                'position' => $e->currentContract?->position,
                'contract_weekly_hours' => $contractHours,
                'contract_window_hours' => $contractWindow,
                'planned_hours' => $plannedHours,
                'available_hours' => $available,
                'fill_rate_pct' => min(100, $fillRate),
                'over_quota' => $plannedHours > $contractWindow,
            ];
        });

        return ['data' => $summary->values()];
    }

    public function longAbsences(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);
        $threshold = (int) \App\Models\AppSetting::get('long_absence_threshold_days', 5);
        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();

        // Absences employés qui chevauchent la fenêtre
        $employeeAbsences = \DB::table('employee_absences')
            ->join('employees', 'employees.id', '=', 'employee_absences.employee_id')
            ->leftJoin('absence_reasons', 'absence_reasons.id', '=', 'employee_absences.absence_reason_id')
            ->whereDate('employee_absences.start_date', '<=', $to)
            ->where(function ($q) use ($from) {
                $q->whereNull('employee_absences.end_date')
                  ->orWhereDate('employee_absences.end_date', '>=', $from);
            })
            ->selectRaw('employee_absences.id, "employee" as kind, employees.id as person_id, employees.name as person_name,
                         employee_absences.start_date, employee_absences.end_date,
                         absence_reasons.label as reason_label,
                         (julianday(coalesce(employee_absences.end_date, ?)) - julianday(employee_absences.start_date) + 1) as days', [$to->toDateString()])
            ->get()
            ->filter(fn ($a) => $a->days >= $threshold)
            ->values();

        return ['data' => $employeeAbsences, 'threshold_days' => $threshold];
    }

    /**
     * Liste les intervenants disponibles sur un créneau donné, avec leur distance
     * au client cible. Sert au "dialog de création RDV" pour aider l'admin.
     *
     * Params : start_datetime, end_datetime, client_id
     * Retour : [{ employee_id, name, distance_km, duration_minutes, has_conflict (bool) }]
     */
    public function availableEmployees(Request $request, \App\Services\GoogleMapsDistanceService $distanceService)
    {
        $data = $request->validate([
            'start_datetime' => ['required', 'date'],
            'end_datetime' => ['required', 'date', 'after:start_datetime'],
            'client_id' => ['required', 'integer', 'exists:clients,id'],
        ]);

        $start = Carbon::parse($data['start_datetime']);
        $end = Carbon::parse($data['end_datetime']);

        // Adresse du client (priorité intervention > main)
        $client = \App\Models\Client::with('addresses')->find($data['client_id']);
        $clientAddr = $client?->addresses
            ->sortBy(fn ($a) => $a->type === 'intervention' ? 0 : ($a->type === 'main' ? 1 : 2))
            ->first(fn ($a) => $a->latitude && $a->longitude);

        $employees = Employee::query()
            ->where('status', 'active')
            ->with(['addresses' => fn ($q) => $q->whereNotNull('latitude')])
            ->get();

        $candidates = $employees->map(function (Employee $e) use ($start, $end, $clientAddr, $distanceService) {
            // Check conflit sur le créneau
            $hasConflict = Intervention::where('employee_id', $e->id)
                ->where('is_exception', false)
                ->where(function ($q) use ($start, $end) {
                    $q->whereBetween('start_datetime', [$start, $end])
                      ->orWhereBetween('end_datetime', [$start, $end])
                      ->orWhere(function ($q) use ($start, $end) {
                          $q->where('start_datetime', '<=', $start)
                            ->where('end_datetime', '>=', $end);
                      });
                })
                ->exists();

            // Distance au client
            $empAddr = $e->addresses->first();
            $dist = null;
            if ($empAddr && $clientAddr) {
                $dist = $distanceService->distance(
                    $empAddr->latitude, $empAddr->longitude,
                    $clientAddr->latitude, $clientAddr->longitude,
                );
            }

            return [
                'employee_id' => $e->id,
                'employee_name' => $e->name,
                'employee_lat' => $empAddr?->latitude,
                'employee_lng' => $empAddr?->longitude,
                'has_conflict' => $hasConflict,
                'distance_km' => $dist['distance_km'] ?? null,
                'duration_minutes' => $dist['duration_minutes'] ?? null,
            ];
        })->sortBy([['has_conflict', 'asc'], ['distance_km', 'asc']])->values();

        return [
            'data' => [
                'candidates' => $candidates,
                'client_address' => $clientAddr ? [
                    'address' => $clientAddr->address,
                    'city' => $clientAddr->city,
                    'lat' => $clientAddr->latitude,
                    'lng' => $clientAddr->longitude,
                ] : null,
            ],
        ];
    }

    /**
     * Calcul des trajets entre RDV consécutifs sur la fenêtre.
     * Applique la règle 45 min (paid_travel_max_minutes paramétrable).
     */
    public function trips(Request $request, InterventionExpander $expander, TripPlannerService $planner)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
            'employee_id' => ['nullable', 'integer'],
        ]);

        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();

        $events = $expander->expandWindow($from, $to);
        if (! empty($data['employee_id'])) {
            $events = $events->filter(fn ($e) => ($e['employee']['id'] ?? null) === (int) $data['employee_id']);
        }

        $trips = $planner->computeTrips($events);
        $summary = $planner->summarize($trips);

        // Stats explicatives : combien de RDV sans intervenant / sans adresse géocodée ?
        // Permet à l'UI d'expliquer "pourquoi 0 trajet" au lieu d'un simple message vide.
        $totalEvents = $events->count();
        $unassigned = $events->filter(fn ($e) => empty($e['employee']['id']))->count();
        $missingAddress = $events->filter(function ($e) {
            return empty($e['client']['address']['latitude'])
                || empty($e['client']['address']['longitude']);
        })->count();

        return [
            'data' => [
                'trips' => $trips->values(),
                'summary' => $summary,
                'paid_threshold_minutes' => (int) \App\Models\AppSetting::get('paid_travel_max_minutes', 45),
                'diagnostics' => [
                    'total_events' => $totalEvents,
                    'unassigned_events' => $unassigned,
                    'events_without_geocoded_address' => $missingAddress,
                ],
            ],
        ];
    }
}
