<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * CRUD contrat intervenant.
 *
 * Règles métier :
 *   - 1 seul contrat actif par employé à un instant T (is_current=true)
 *   - Lorsqu'un nouveau contrat est créé en is_current, les autres passent à false
 *   - Possibilité d'avoir plusieurs contrats archivés (historique)
 */
class ContractController extends Controller
{
    private function authEdit(Request $request): void
    {
        abort_unless($request->user()?->can('contracts.edit'), 403);
    }

    public function list(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('contracts.view'), 403);
        return ['data' => $employee->contracts()->orderByDesc('is_current')->orderByDesc('start_date')->get()];
    }

    public function show(Request $request, Employee $employee, int $contractId)
    {
        abort_unless($request->user()?->can('contracts.view'), 403);
        $contract = Contract::where('employee_id', $employee->id)->where('id', $contractId)->firstOrFail();
        return ['data' => $contract];
    }

    public function store(Request $request, Employee $employee)
    {
        $this->authEdit($request);
        $data = $this->validateContract($request);
        $data['employee_id'] = $employee->id;

        $contract = DB::transaction(function () use ($data, $employee) {
            // Si on crée en is_current, désactive les autres
            if (! empty($data['is_current'])) {
                $employee->contracts()->update(['is_current' => false]);
            }
            return Contract::create($data);
        });

        return response()->json(['data' => $contract], 201);
    }

    public function update(Request $request, Employee $employee, int $contractId)
    {
        $this->authEdit($request);
        $contract = Contract::where('employee_id', $employee->id)->where('id', $contractId)->firstOrFail();
        $data = $this->validateContract($request, partial: true);

        DB::transaction(function () use ($data, $contract, $employee) {
            if (! empty($data['is_current'])) {
                $employee->contracts()->where('id', '!=', $contract->id)->update(['is_current' => false]);
            }
            $contract->update($data);
        });

        return ['data' => $contract->fresh()];
    }

    public function destroy(Request $request, Employee $employee, int $contractId)
    {
        $this->authEdit($request);
        Contract::where('employee_id', $employee->id)->where('id', $contractId)->delete();
        return response()->noContent();
    }

    private function validateContract(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'nullable';
        // Champs minimum requis à la création
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'entity_id' => [$required, 'exists:entities,id'],
            'position' => [$required, 'string', 'max:255'],
            'contract_type' => [$required, 'in:cdi,cdd,stage'],
            'intervention_zone' => [$req, 'string', 'max:255'],
            'is_current' => ['nullable', 'boolean'],

            // CDI
            'activity_modality' => [$req, 'string', 'max:64'],
            'is_cdi_inclusion' => ['nullable', 'boolean'],
            // CDD
            'cdd_reason' => [$req, 'string', 'max:255'],
            'cdd_imprecise_term' => ['nullable', 'boolean'],
            'end_date' => [$req, 'date'],
            'precarity_payment' => ['nullable', 'boolean'],
            // Stage
            'tutor_name' => [$req, 'string', 'max:255'],
            'is_mandatory_internship' => ['nullable', 'boolean'],

            // Dates
            'start_date' => [$req, 'date'],
            'trial_period' => ['nullable', 'boolean'],
            'trial_start' => [$req, 'date'],
            'trial_end' => [$req, 'date'],
            'trial_renewed' => ['nullable', 'boolean'],
            'first_intervention_date' => [$req, 'date'],
            'sent_date' => [$req, 'date'],
            'signed_date' => [$req, 'date'],
            'dpae_date' => [$req, 'date'],
            'is_non_salarie' => ['nullable', 'boolean'],

            // Rémunération
            'work_time_type' => [$req, 'in:full_time,part_time'],
            'monthly_duration' => [$req, 'numeric', 'min:0'],
            'weekly_duration' => [$req, 'numeric', 'min:0'],
            'pay_mode' => [$req, 'in:monthly_salary,hourly_salary'],
            'monthly_salary' => [$req, 'numeric', 'min:0'],
            'hourly_rate' => [$req, 'numeric', 'min:0'],

            // Indemnités km
            'km_rate_inter_vacation' => [$req, 'numeric', 'min:0'],
            'km_rate_intervention' => [$req, 'numeric', 'min:0'],

            // Paie
            'qualification' => [$req, 'string', 'max:255'],
            'employee_status' => [$req, 'in:non_cadre,cadre'],
            'seniority_date' => [$req, 'date'],
            'profession_code' => [$req, 'string', 'max:64'],
            'socio_professional_category' => [$req, 'string', 'max:255'],
            'conventional_categorical_status' => [$req, 'string', 'max:255'],
            'conventional_classification' => [$req, 'string', 'max:255'],
            'non_compete_clause' => ['nullable', 'boolean'],
            'is_accre_beneficiary' => ['nullable', 'boolean'],
            'geographic_zone' => [$req, 'in:france_metro,alsace_moselle,dom'],

            // Complémentaire santé
            'health_insurance' => [$req, 'string', 'max:64'],
            'health_insurance_reason' => [$req, 'string', 'max:255'],

            'comment' => [$req, 'string'],
        ]);
    }
}
