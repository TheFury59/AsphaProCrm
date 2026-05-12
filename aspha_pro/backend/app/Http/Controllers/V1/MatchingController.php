<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Intervention;
use App\Models\MatchingRequest;
use App\Services\InterventionMatchingService;
use Illuminate\Http\Request;

/**
 * Endpoints matching auto intervenant (Phase 10).
 *
 *  - GET /interventions/{intervention}/match    → suggestions triées
 *  - POST /matching-requests                    → crée une demande de matching (trackée)
 *  - PATCH /matching-requests/{id}/assign       → confirme l'affectation choisie
 *  - GET /matching-requests                     → historique
 */
class MatchingController extends Controller
{
    public function suggest(Request $request, Intervention $intervention, InterventionMatchingService $service)
    {
        $limit = (int) $request->query('limit', 10);
        $candidates = $service->findCandidates($intervention, max(1, min(50, $limit)));
        return ['data' => $candidates];
    }

    public function index(Request $request)
    {
        return ['data' => MatchingRequest::query()
            ->with(['recurrence:id,start_datetime', 'selectedEmployee:id,name', 'requestedBy:id,name'])
            ->orderByDesc('id')
            ->paginate(50)];
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'recurrence_id' => ['required', 'exists:interventions,id'],
            'intervention_id' => ['nullable', 'exists:interventions,id'],
            'assignment_type' => ['nullable', 'in:definitive,temporary'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $matching = MatchingRequest::create($data + [
            'requested_by' => $request->user()->id,
            'status' => 'pending',
        ]);
        return response()->json(['data' => $matching], 201);
    }

    public function assign(Request $request, MatchingRequest $matchingRequest)
    {
        $data = $request->validate([
            'selected_employee_id' => ['required', 'exists:employees,id'],
        ]);

        $matchingRequest->update([
            'selected_employee_id' => $data['selected_employee_id'],
            'status' => 'assigned',
        ]);

        // Propage l'affectation sur l'intervention récurrente parente
        Intervention::where('id', $matchingRequest->recurrence_id)
            ->update(['employee_id' => $data['selected_employee_id']]);

        return ['data' => $matchingRequest->fresh()->load('selectedEmployee:id,name')];
    }

    public function cancel(Request $request, MatchingRequest $matchingRequest)
    {
        $matchingRequest->update(['status' => 'cancelled']);
        return ['data' => $matchingRequest];
    }
}
