<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\DeductionPayment;
use App\Models\Employee;
use App\Models\SalaryDeduction;
use App\Models\SalaryDeductionDebt;
use Illuminate\Http\Request;

/**
 * Saisies sur salaire d'un intervenant.
 * Structure :
 *   - SalaryDeduction (un dossier de saisie : créancier + n° dossier)
 *     ↳ SalaryDeductionDebt (lignes de dette)
 *     ↳ DeductionPayment (paiements effectués)
 */
class SalaryDeductionController extends Controller
{
    private function authEdit(Request $request): void
    {
        abort_unless($request->user()?->can('payroll.view'), 403);
    }

    public function list(Request $request, Employee $employee)
    {
        $this->authEdit($request);
        $deductions = $employee->salaryDeductions()->with(['salaryDeductionDebts', 'deductionPayments'])->get();
        return ['data' => $deductions];
    }

    public function store(Request $request, Employee $employee)
    {
        $this->authEdit($request);
        $data = $request->validate([
            'creditor_name' => ['required', 'string', 'max:255'],
            'case_number' => ['nullable', 'string', 'max:128'],
            'address' => ['nullable', 'string'],
            'payment_method' => ['required', 'in:transfer,check,cash'],
            'comment' => ['nullable', 'string'],
        ]);
        $data['employee_id'] = $employee->id;
        $deduction = SalaryDeduction::create($data);
        return response()->json(['data' => $deduction], 201);
    }

    public function destroy(Request $request, Employee $employee, int $deductionId)
    {
        $this->authEdit($request);
        SalaryDeduction::where('employee_id', $employee->id)->where('id', $deductionId)->delete();
        return response()->noContent();
    }

    public function addDebt(Request $request, Employee $employee, int $deductionId)
    {
        $this->authEdit($request);
        $deduction = SalaryDeduction::where('employee_id', $employee->id)->where('id', $deductionId)->firstOrFail();
        $data = $request->validate([
            'type' => ['required', 'string', 'max:64'],
            'is_alimony_calculated' => ['nullable', 'boolean'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'priority' => ['nullable', 'integer'],
            'total_due' => ['required', 'numeric', 'min:0'],
            'partial_release_amount' => ['nullable', 'numeric', 'min:0'],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'balance' => ['nullable', 'numeric'],
            'full_release_date' => ['nullable', 'date'],
        ]);
        $data['salary_deduction_id'] = $deduction->id;
        return response()->json(['data' => SalaryDeductionDebt::create($data)], 201);
    }

    public function addPayment(Request $request, Employee $employee, int $deductionId)
    {
        $this->authEdit($request);
        $deduction = SalaryDeduction::where('employee_id', $employee->id)->where('id', $deductionId)->firstOrFail();
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'paid_at' => ['required', 'date'],
            'method' => ['nullable', 'string', 'max:32'],
            'note' => ['nullable', 'string'],
        ]);
        $data['salary_deduction_id'] = $deduction->id;
        return response()->json(['data' => DeductionPayment::create($data)], 201);
    }
}
