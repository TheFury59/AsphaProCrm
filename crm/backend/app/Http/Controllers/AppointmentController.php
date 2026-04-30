<?php

namespace App\Http\Controllers;

use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AppointmentController extends Controller
{
    /**
     * Feed for FullCalendar.
     * GET /api/appointments?from=ISO&to=ISO&employee_id=&client_id=
     */
    public function index(Request $request)
    {
        $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
        ]);

        $from = Carbon::parse($request->query('from'));
        $to = Carbon::parse($request->query('to'));

        $query = Appointment::query()
            ->with([
                'serviceAssignment.service',
                'serviceAssignment.client',
                'employee',
                'clientAddress',
            ])
            ->whereBetween('scheduled_start', [$from, $to]);

        if ($id = $request->integer('employee_id')) {
            $query->where('employee_id', $id);
        }
        if ($id = $request->integer('client_id')) {
            $query->whereHas('serviceAssignment', fn ($q) => $q->where('client_id', $id));
        }

        return AppointmentResource::collection(
            $query->orderBy('scheduled_start')->get()
        );
    }

    public function show(Appointment $appointment)
    {
        $appointment->load([
            'serviceAssignment.service',
            'serviceAssignment.client',
            'employee',
            'clientAddress',
        ]);
        return new AppointmentResource($appointment);
    }

    /**
     * Drag-and-drop : update scheduled times and/or employee.
     */
    public function update(Request $request, Appointment $appointment)
    {
        $data = $request->validate([
            'scheduled_start' => ['sometimes', 'date'],
            'scheduled_end' => ['sometimes', 'date', 'after:scheduled_start'],
            'employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'status' => ['sometimes', Rule::in([
                Appointment::STATUS_PLANNED,
                Appointment::STATUS_DONE,
                Appointment::STATUS_CANCELLED,
                Appointment::STATUS_NO_SHOW,
            ])],
            'paid_to_employee' => ['sometimes', 'boolean'],
            'invoiced_to_client' => ['sometimes', 'boolean'],
            'admin_notes' => ['sometimes', 'nullable', 'string'],
        ]);

        $data['last_modified_by_user_id'] = $request->user()->id;
        $appointment->update($data);

        $appointment->load([
            'serviceAssignment.service',
            'serviceAssignment.client',
            'employee',
            'clientAddress',
        ]);
        return new AppointmentResource($appointment);
    }

    public function destroy(Appointment $appointment)
    {
        $appointment->delete();
        return response()->noContent();
    }
}
