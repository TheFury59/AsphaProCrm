<?php

namespace App\Http\Controllers;

use App\Http\Resources\EmployeeResource;
use App\Models\Appointment;
use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index()
    {
        return EmployeeResource::collection(
            Employee::with('currentContract')
                ->where('status', Employee::STATUS_ACTIVE)
                ->orderBy('first_name')
                ->get()
        );
    }

    public function show(Employee $employee)
    {
        $employee->load('currentContract');
        return new EmployeeResource($employee);
    }

    /**
     * Suivi du remplissage des heures contractuelles (CDC § 4.2.5).
     *
     * GET /api/employees/{id}/contract-status?from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    public function contractStatus(Employee $employee, Request $request)
    {
        $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $from = Carbon::parse($request->query('from'))->startOfDay();
        $to = Carbon::parse($request->query('to'))->endOfDay();
        $weeks = max(1, (int) ceil($from->diffInDays($to) / 7));

        $contract = $employee->currentContract;
        $weeklyHours = $contract ? (float) $contract->weekly_hours : 0;
        $contractHoursWindow = $weeklyHours * $weeks;

        $minutesPlanned = Appointment::query()
            ->where('employee_id', $employee->id)
            ->whereBetween('scheduled_start', [$from, $to])
            ->whereIn('status', [Appointment::STATUS_PLANNED, Appointment::STATUS_DONE])
            ->get()
            ->sum(fn ($a) => $a->durationMinutes());

        $hoursPlanned = round($minutesPlanned / 60, 2);
        $remaining = round($contractHoursWindow - $hoursPlanned, 2);
        $fillRate = $contractHoursWindow > 0 ? round(($hoursPlanned / $contractHoursWindow) * 100, 1) : 0;

        return response()->json([
            'employee_id' => $employee->id,
            'window' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'weeks' => $weeks],
            'weekly_hours' => $weeklyHours,
            'contract_hours' => round($contractHoursWindow, 2),
            'hours_planned' => $hoursPlanned,
            'hours_remaining' => $remaining,
            'fill_rate' => $fillRate, // %
        ]);
    }
}
