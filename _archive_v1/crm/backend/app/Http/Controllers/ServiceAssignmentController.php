<?php

namespace App\Http\Controllers;

use App\Models\ServiceAssignment;
use App\Services\AppointmentMaterializer;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceAssignmentController extends Controller
{
    public function __construct(private AppointmentMaterializer $materializer) {}

    public function store(Request $request)
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'client_address_id' => ['required', 'integer', 'exists:client_addresses,id'],
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'default_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'type' => ['required', Rule::in([ServiceAssignment::TYPE_PUNCTUAL, ServiceAssignment::TYPE_RECURRING])],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'duration_minutes' => ['required', 'integer', 'min:15', 'max:1440'],
            'notes' => ['nullable', 'string'],

            // Ponctuel
            'scheduled_date' => ['required_if:type,punctual', 'nullable', 'date'],
            'scheduled_time' => ['required_if:type,punctual', 'nullable', 'date_format:H:i'],

            // Récurrent
            'recurrence_start' => ['required_if:type,recurring', 'nullable', 'date'],
            'recurrence_end' => ['nullable', 'date', 'after_or_equal:recurrence_start'],
            'recurrence_time' => ['required_if:type,recurring', 'nullable', 'date_format:H:i'],
            'recurrence_rule' => ['required_if:type,recurring', 'nullable', 'string', 'regex:/^FREQ=/'],
        ]);

        $data['status'] = ServiceAssignment::STATUS_ACTIVE;
        $data['created_by_user_id'] = $request->user()->id;

        $sa = ServiceAssignment::create($data);

        // Matérialise immédiatement les appointments sur 8 semaines à partir de maintenant
        $from = now()->startOfDay();
        $to = now()->addWeeks(8)->endOfDay();
        $created = $this->materializer->materializeOne($sa, $from, $to);

        return response()->json([
            'service_assignment' => $sa->load(['service', 'client', 'clientAddress', 'defaultEmployee']),
            'appointments_created' => $created,
        ], 201);
    }

    public function destroy(ServiceAssignment $serviceAssignment)
    {
        $serviceAssignment->delete();
        return response()->noContent();
    }
}
