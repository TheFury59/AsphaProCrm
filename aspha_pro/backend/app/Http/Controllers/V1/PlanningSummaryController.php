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
    /**
     * Force le filtre `employee_id` au compte de l'utilisateur connecté si
     * celui-ci n'est ni admin ni super_admin (typiquement un intervenant
     * qui consulte ses propres données via l'extranet).
     *
     * Sécurité : sans cette garde, un intervenant authentifié pouvait lister
     * trips/contract/longAbsences de TOUS ses collègues (cf. audit 2026-05-19).
     * Les clients (rôle `client`) sont refusés — ils ont leurs endpoints
     * dédiés `/extranet/client/*`.
     */
    private function enforceEmployeeScope(Request $request, ?int $requestedEmployeeId): ?int
    {
        $user = $request->user();
        abort_unless($user, 401);

        if ($user->hasRole('super_admin') || $user->hasRole('admin')) {
            return $requestedEmployeeId;
        }

        // Pour rôle intervenant : on retrouve son employee_id et on force
        $employee = Employee::where('user_id', $user->id)->first();
        if ($employee) {
            return $employee->id;
        }

        // Tout autre rôle (client, etc.) : refus
        abort(403, 'Accès interdit aux endpoints de planning admin.');
    }

    public function contractSummary(Request $request, InterventionExpander $expander)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
            'employee_id' => ['nullable', 'integer'],
        ]);
        $data['employee_id'] = $this->enforceEmployeeScope($request, $data['employee_id'] ?? null);

        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();
        $daysInWindow = $from->diffInDays($to) + 1;
        $weeksInWindow = $daysInWindow / 7;

        // NB : employees n'a pas de colonne `status` — le soft delete (deleted_at)
        // sert d'archive. Le model Employee use SoftDeletes → get() exclut
        // déjà les archivés automatiquement.
        $employees = Employee::query()
            ->when(! empty($data['employee_id']), fn ($q) => $q->where('id', $data['employee_id']))
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
        $user = $request->user();
        abort_unless($user, 401);
        // Sécurité : seuls admin/super_admin voient les absences de tous les
        // intervenants. Les autres rôles n'ont rien à faire ici. Cf. audit
        // 2026-05-19 ("RGPD : un intervenant ne doit pas voir les absences
        // longue durée de ses collègues").
        abort_unless($user->hasRole('super_admin') || $user->hasRole('admin'), 403);

        $threshold = (int) \App\Models\AppSetting::get('long_absence_threshold_days', 5);
        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();

        // Absences employés qui chevauchent la fenêtre.
        // NOTE : la FK s'appelle `reason_id` (pas `absence_reason_id`).
        // NOTE 2 : on calcule `days` en PHP plutôt qu'en SQL pour rester
        // compatible MariaDB/Postgres (`julianday()` est SQLite-only,
        // cassait en prod — audit 2026-05-19).
        $employeeAbsences = \DB::table('employee_absences')
            ->join('employees', 'employees.id', '=', 'employee_absences.employee_id')
            ->leftJoin('absence_reasons', 'absence_reasons.id', '=', 'employee_absences.reason_id')
            ->whereNotNull('employee_absences.start_date')
            ->whereDate('employee_absences.start_date', '<=', $to)
            ->where(function ($q) use ($from) {
                $q->whereNull('employee_absences.end_date')
                  ->orWhereDate('employee_absences.end_date', '>=', $from);
            })
            ->select(
                'employee_absences.id',
                \DB::raw('"employee" as kind'),
                'employees.id as person_id',
                'employees.name as person_name',
                'employee_absences.start_date',
                'employee_absences.end_date',
                'absence_reasons.label as reason_label',
            )
            ->get()
            ->map(function ($a) use ($to) {
                $start = Carbon::parse($a->start_date);
                $end = $a->end_date ? Carbon::parse($a->end_date) : $to;
                $a->days = $start->diffInDays($end) + 1;
                return $a;
            })
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
        // Endpoint admin-only : utilisé par le dialog d'assignation côté
        // planning. Aucun usage extranet → on bloque les rôles non-admin.
        $user = $request->user();
        abort_unless($user, 401);
        abort_unless(
            $user->hasRole('super_admin') || $user->hasRole('admin') || $user->can('planning.edit'),
            403,
        );

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
            ->with(['addresses' => fn ($q) => $q->whereNotNull('latitude')])
            ->get();

        $candidates = $employees->map(function (Employee $e) use ($start, $end, $clientAddr, $distanceService) {
            // Récupère le ou les RDV qui chevauchent le créneau (avec détails pour l'UI)
            $conflictingInterventions = Intervention::where('employee_id', $e->id)
                ->where('is_exception', false)
                ->where(function ($q) use ($start, $end) {
                    $q->whereBetween('start_datetime', [$start, $end])
                      ->orWhereBetween('end_datetime', [$start, $end])
                      ->orWhere(function ($q) use ($start, $end) {
                          $q->where('start_datetime', '<=', $start)
                            ->where('end_datetime', '>=', $end);
                      });
                })
                ->with('client:id,code')
                ->limit(3)  // max 3 pour l'affichage
                ->get();

            $hasConflict = $conflictingInterventions->isNotEmpty();
            $conflicts = $conflictingInterventions->map(fn ($c) => [
                'intervention_id' => $c->id,
                'client_code' => $c->client?->code,
                'start_time' => $c->start_datetime?->format('H:i'),
                'end_time' => $c->end_datetime?->format('H:i'),
                'status' => $c->status,
            ])->values();

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
                'conflicts' => $conflicts,
                'distance_km' => $dist['distance_km'] ?? null,
                'duration_minutes' => $dist['duration_minutes'] ?? null,
                'source' => $dist['source'] ?? null,
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
        $data['employee_id'] = $this->enforceEmployeeScope($request, $data['employee_id'] ?? null);

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
