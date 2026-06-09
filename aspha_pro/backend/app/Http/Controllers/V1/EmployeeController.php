<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\V1\StoreEmployeeRequest;
use App\Http\Requests\V1\UpdateEmployeeRequest;
use App\Http\Resources\V1\EmployeeResource;
use App\Models\Employee;
use App\Models\Intervention;
use App\Services\EmployeeScoringService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('employees.view'), 403);

        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Employee::class)
            ->allowedFilters([
                'classification',
                'entity_id',
                'owner_user_id',
                AllowedFilter::callback('search', fn ($q, $value) =>
                    $q->where('name', 'like', "%{$value}%")
                      ->orWhere('phone', 'like', "%{$value}%")
                ),
            ])
            ->allowedSorts(['name', 'classification', 'created_at'])
            ->defaultSort('name')
            ->with(['user:id,name,email,status,avatar_path,updated_at', 'entity:id,name', 'ownerUser:id,name', 'currentContract', 'addresses'])
            ->withCount(['contracts', 'absences', 'trainings', 'interventions', 'salaryDeductions']);

        return EmployeeResource::collection($query->paginate($perPage));
    }

    public function show(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.view'), 403);

        $employee->load([
            // avatar_path nécessaire pour le fallback Employee::avatar_url
            // qui retourne en priorité l'avatar perso du user lié (unification
            // mobile + web côté /me/avatar, cf. 2026-06-09).
            'user:id,name,email,status,last_login_at,avatar_path,updated_at',
            'entity', 'ownerUser:id,name',
            'currentContract', 'skills', 'addresses',
        ])->loadCount(['contracts', 'absences', 'trainings', 'interventions', 'salaryDeductions']);

        return new EmployeeResource($employee);
    }

    public function store(StoreEmployeeRequest $request)
    {
        $employee = DB::transaction(function () use ($request) {
            $data = $request->only([
                'user_id', 'entity_id', 'owner_user_id', 'name', 'phone', 'email',
                'classification', 'transport_mode', 'has_company_vehicle',
                'diploma', 'job_reference_free',
            ]);
            // owner_user_id est NOT NULL en BDD : on défaut sur l'utilisateur courant
            // (= "qui a créé / gère ce dossier intervenant") si pas explicitement fourni.
            $data['owner_user_id'] = $data['owner_user_id'] ?? $request->user()->id;

            $employee = Employee::create($data);

            if ($request->filled('skill_ids')) {
                $employee->skills()->sync($request->input('skill_ids'));
            }

            return $employee;
        });

        $employee->load(['user', 'entity', 'currentContract', 'skills']);
        return (new EmployeeResource($employee))->response()->setStatusCode(201);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee)
    {
        DB::transaction(function () use ($request, $employee) {
            $employee->update($request->only([
                'user_id', 'entity_id', 'owner_user_id', 'name', 'phone', 'email',
                'classification', 'transport_mode', 'has_company_vehicle',
                'diploma', 'job_reference_free',
            ]));

            if ($request->has('skill_ids')) {
                $employee->skills()->sync($request->input('skill_ids') ?? []);
            }
        });

        $employee->load(['user', 'entity', 'currentContract', 'skills']);
        return new EmployeeResource($employee);
    }

    public function destroy(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.delete'), 403);

        // audit 2026-05-19 — garde-fou anti-orphelins : si l'intervenant a des RDV
        // futurs assignés, refuser la suppression. L'admin peut forcer via ?force=1
        // mais doit choisir entre ré-assigner ou laisser orphelin.
        $force = $request->boolean('force');
        $isSuperAdmin = $request->user()?->hasRole('super_admin') ?? false;

        if (! $force) {
            $futureCount = Intervention::where('employee_id', $employee->id)
                ->where('start_datetime', '>=', now())
                ->whereNotIn('status', ['annulee', 'realisee', 'terminated'])
                ->count();
            if ($futureCount > 0) {
                abort(409, "Impossible de supprimer : {$futureCount} intervention(s) future(s) assignée(s). Réassignez-les d'abord, ou forcez via ?force=1 (admin uniquement).");
            }
        } elseif (! $isSuperAdmin) {
            abort(403, "Seul un super-admin peut forcer la suppression d'un intervenant avec interventions futures.");
        }

        $employee->delete();
        return response()->noContent();
    }

    /**
     * GET /employees/{employee}/score
     *
     * Note de notation de l'intervenant : note globale 0-100 + 4 critères
     * (absences, assiduité, badgeage, relation) calculés depuis les données
     * réelles. Période par défaut : 90 derniers jours, surchargeable via
     * `?since=YYYY-MM-DD`.
     *
     * Réservé aux admins (permission `employees.view`, comme `show`).
     */
    public function score(Request $request, Employee $employee, EmployeeScoringService $scoring)
    {
        abort_unless($request->user()?->can('employees.view'), 403);

        $since = null;
        if ($request->filled('since')) {
            try {
                $since = \Carbon\Carbon::parse((string) $request->query('since'))->startOfDay();
            } catch (\Throwable) {
                // Date invalide → on ignore et on retombe sur la période par défaut.
                $since = null;
            }
        }

        return ['data' => $scoring->computeScore($employee, $since)];
    }
}
