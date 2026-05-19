<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\V1\StoreEmployeeRequest;
use App\Http\Requests\V1\UpdateEmployeeRequest;
use App\Http\Resources\V1\EmployeeResource;
use App\Models\Employee;
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
            ->with(['user:id,name,email,status', 'entity:id,name', 'ownerUser:id,name', 'currentContract', 'addresses'])
            ->withCount(['contracts', 'absences', 'trainings', 'interventions', 'salaryDeductions']);

        return EmployeeResource::collection($query->paginate($perPage));
    }

    public function show(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.view'), 403);

        $employee->load([
            'user:id,name,email,status,last_login_at',
            'entity', 'ownerUser:id,name',
            'currentContract', 'skills', 'addresses',
        ])->loadCount(['contracts', 'absences', 'trainings', 'interventions', 'salaryDeductions']);

        return new EmployeeResource($employee);
    }

    public function store(StoreEmployeeRequest $request)
    {
        $employee = DB::transaction(function () use ($request) {
            $data = $request->only([
                'user_id', 'entity_id', 'owner_user_id', 'name', 'phone',
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
                'user_id', 'entity_id', 'owner_user_id', 'name', 'phone',
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
        $employee->delete();
        return response()->noContent();
    }
}
