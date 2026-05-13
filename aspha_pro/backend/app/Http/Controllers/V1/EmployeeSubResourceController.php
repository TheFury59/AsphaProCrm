<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAbsence;
use App\Models\Training;
use Illuminate\Http\Request;

/**
 * Sous-ressources d'Employee :
 *   - addresses (polymorphique)
 *   - absences (ponctuelles + périodiques + dispos/indispos unifiées via entry_type)
 *   - trainings (onboarding + ongoing via training_phase)
 *   - skills (sync via N-N pivot)
 */
class EmployeeSubResourceController extends Controller
{
    private function authorizeEdit(Request $request): void
    {
        abort_unless($request->user()?->can('employees.edit'), 403);
    }

    // ========== ADDRESSES (polymorphic) ==========
    public function listAddresses(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.view'), 403);
        return ['data' => $employee->addresses()->get()];
    }

    public function storeAddress(Request $request, Employee $employee)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'type' => ['required', 'in:main,billing,intervention,other'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:128'],
            'postal_code' => ['required', 'string', 'max:16'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
        ]);
        return response()->json(['data' => $employee->addresses()->create($data)], 201);
    }

    public function updateAddress(Request $request, Employee $employee, int $addressId)
    {
        $this->authorizeEdit($request);
        $a = $employee->addresses()->where('id', $addressId)->firstOrFail();
        $a->update($request->validate([
            'type' => ['sometimes', 'in:main,billing,intervention,other'],
            'address' => ['sometimes', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:128'],
            'postal_code' => ['sometimes', 'string', 'max:16'],
            'latitude' => ['sometimes', 'nullable', 'numeric'],
            'longitude' => ['sometimes', 'nullable', 'numeric'],
        ]));
        return ['data' => $a];
    }

    public function destroyAddress(Request $request, Employee $employee, int $addressId)
    {
        $this->authorizeEdit($request);
        $employee->addresses()->where('id', $addressId)->delete();
        return response()->noContent();
    }

    // ========== ABSENCES (unified — entry_type filters dispos/indispos/absence/rest) ==========
    public function listAbsences(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.view'), 403);
        $q = $employee->absences()->with('reason');
        if ($t = $request->query('entry_type')) {
            $q->where('entry_type', $t);
        }
        return ['data' => $q->orderByDesc('id')->get()];
    }

    public function storeAbsence(Request $request, Employee $employee)
    {
        $this->authorizeEdit($request);
        $data = $this->validateAbsence($request);

        // Quick-add depuis le planning : motif libre → fusionne dans le commentaire
        if (! empty($data['reason']) && empty($data['comment'])) {
            $data['comment'] = $data['reason'];
        }
        unset($data['reason']);

        // Defaults pragmatiques pour le quick-add
        $data['entry_type'] = $data['entry_type'] ?? 'absence';
        $data['is_full_day'] = $data['is_full_day'] ?? true;

        $absence = $employee->absences()->create($data);
        $absence->load('reason');
        return response()->json(['data' => $absence], 201);
    }

    public function updateAbsence(Request $request, Employee $employee, int $absenceId)
    {
        $this->authorizeEdit($request);
        $absence = EmployeeAbsence::where('employee_id', $employee->id)->where('id', $absenceId)->firstOrFail();
        $absence->update($this->validateAbsence($request, partial: true));
        $absence->load('reason');
        return ['data' => $absence];
    }

    public function destroyAbsence(Request $request, Employee $employee, int $absenceId)
    {
        $this->authorizeEdit($request);
        EmployeeAbsence::where('employee_id', $employee->id)->where('id', $absenceId)->delete();
        return response()->noContent();
    }

    private function validateAbsence(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        return $request->validate([
            // reason_id nullable pour permettre la création rapide depuis le clic droit planning
            // (le motif libre va dans `comment`)
            'reason_id' => ['nullable', 'exists:absence_reasons,id'],
            'entry_type' => ['nullable', 'in:absence,availability,unavailability,weekly_rest'],
            // Champ libre accepté en lieu et place de reason_id depuis quick-add
            'reason' => ['nullable', 'string', 'max:255'],
            'is_hourly' => ['nullable', 'boolean'],
            'planning_action' => ['nullable', 'in:none,flag,reassign'],
            'justification_status' => ['nullable', 'in:pending,justified,unjustified'],
            'comment' => ['nullable', 'string'],
            'is_periodic' => ['nullable', 'boolean'],
            'start_datetime' => ['nullable', 'date'],
            'duration_hours' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date'],
            'is_full_day' => ['nullable', 'boolean'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'frequency' => ['nullable', 'in:daily,weekly,monthly,yearly'],
            'interval' => ['nullable', 'integer', 'min:1'],
            'days_of_week' => ['nullable', 'string'],
            'exclude_school_holidays' => ['nullable', 'boolean'],
            'exclude_public_holidays' => ['nullable', 'boolean'],
            'end_type' => ['nullable', 'in:never,on_date,after_occurrences'],
            'end_date' => ['nullable', 'date'],
            'occurrences_count' => ['nullable', 'integer', 'min:1'],
            'transfer_prestation' => ['nullable', 'boolean'],
        ]);
    }

    // ========== TRAININGS ==========
    public function listTrainings(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.view'), 403);
        return ['data' => $employee->trainings()->orderByDesc('start_date')->get()];
    }

    public function storeTraining(Request $request, Employee $employee)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'training_phase' => ['required', 'in:onboarding,ongoing'],
            'title' => ['required', 'string', 'max:255'],
            'training_center' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'hours_count' => ['nullable', 'numeric', 'min:0'],
            'trainer' => ['nullable', 'string', 'max:255'],
            'is_paid' => ['nullable', 'boolean'],
            'comment' => ['nullable', 'string'],
        ]);
        return response()->json(['data' => $employee->trainings()->create($data)], 201);
    }

    public function updateTraining(Request $request, Employee $employee, int $trainingId)
    {
        $this->authorizeEdit($request);
        $training = Training::where('employee_id', $employee->id)->where('id', $trainingId)->firstOrFail();
        $training->update($request->validate([
            'training_phase' => ['sometimes', 'in:onboarding,ongoing'],
            'title' => ['sometimes', 'string', 'max:255'],
            'training_center' => ['sometimes', 'nullable', 'string', 'max:255'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'hours_count' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'trainer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_paid' => ['sometimes', 'boolean'],
            'comment' => ['sometimes', 'nullable', 'string'],
        ]));
        return ['data' => $training];
    }

    public function destroyTraining(Request $request, Employee $employee, int $trainingId)
    {
        $this->authorizeEdit($request);
        Training::where('employee_id', $employee->id)->where('id', $trainingId)->delete();
        return response()->noContent();
    }

    // ========== SKILLS (toggle / sync) ==========
    public function syncSkills(Request $request, Employee $employee)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'skill_ids' => ['required', 'array'],
            'skill_ids.*' => ['integer', 'exists:skills,id'],
        ]);
        $employee->skills()->sync($data['skill_ids']);
        $employee->load('skills');
        return ['data' => $employee->skills];
    }
}
