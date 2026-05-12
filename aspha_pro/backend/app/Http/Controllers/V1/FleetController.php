<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\VehicleAssignment;
use App\Models\VehicleIncident;
use App\Models\VehicleMaintenance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Gestion de flotte véhicules (Phase 9).
 *
 * Règles métier :
 *  - Une seule attribution active (end_date NULL) par véhicule
 *  - Nouvelle attribution = clôture auto de la précédente
 *  - current_mileage du véhicule maj depuis le mileage du dernier entretien
 *  - Alerte si insurance_expires_at < J+30 ou next_inspection_at < J+30
 */
class FleetController extends Controller
{
    // ========== VEHICLES ==========

    public function index(Request $request)
    {
        $query = QueryBuilder::for(Vehicle::class)
            ->allowedFilters([
                'entity_id', 'status', 'fuel_type',
                AllowedFilter::callback('search', fn ($q, $v) =>
                    $q->where('license_plate', 'like', "%$v%")
                      ->orWhere('brand', 'like', "%$v%")
                      ->orWhere('model', 'like', "%$v%")
                ),
                AllowedFilter::callback('expires_soon', fn ($q, $v) => $v
                    ? $q->where(function ($q) {
                        $q->where('insurance_expires_at', '<=', now()->addDays(30))
                          ->orWhere('next_inspection_at', '<=', now()->addDays(30));
                    })
                    : null),
            ])
            ->allowedSorts(['license_plate', 'brand', 'year', 'created_at', 'insurance_expires_at'])
            ->defaultSort('license_plate')
            ->with(['currentAssignment.employee:id,name', 'entity:id,name']);

        return ['data' => $query->paginate(50)];
    }

    public function show(Request $request, Vehicle $vehicle)
    {
        $vehicle->load([
            'currentAssignment.employee:id,name',
            'assignments.employee:id,name',
            'maintenances',
            'incidents',
        ]);
        return ['data' => $vehicle];
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'entity_id' => ['nullable', 'exists:entities,id'],
            'license_plate' => ['required', 'string', 'unique:vehicles,license_plate', 'max:32'],
            'brand' => ['nullable', 'string', 'max:64'],
            'model' => ['nullable', 'string', 'max:64'],
            'year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'fuel_type' => ['nullable', 'in:gasoline,diesel,electric,hybrid'],
            'purchase_date' => ['nullable', 'date'],
            'insurance_expires_at' => ['nullable', 'date'],
            'next_inspection_at' => ['nullable', 'date'],
            'current_mileage' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $vehicle = Vehicle::create($data + ['status' => 'active']);
        return response()->json(['data' => $vehicle], 201);
    }

    public function update(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'brand' => ['sometimes', 'string', 'max:64'],
            'model' => ['sometimes', 'string', 'max:64'],
            'year' => ['sometimes', 'integer'],
            'fuel_type' => ['sometimes', 'in:gasoline,diesel,electric,hybrid'],
            'insurance_expires_at' => ['sometimes', 'nullable', 'date'],
            'next_inspection_at' => ['sometimes', 'nullable', 'date'],
            'current_mileage' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', 'in:active,maintenance,sold,scrapped'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);
        $vehicle->update($data);
        return ['data' => $vehicle->fresh()];
    }

    public function destroy(Request $request, Vehicle $vehicle)
    {
        $vehicle->delete();  // soft delete
        return response()->noContent();
    }

    // ========== ASSIGNMENTS ==========

    public function assign(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'start_date' => ['required', 'date'],
            'start_mileage' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($vehicle, $data) {
            // Clôt l'attribution en cours s'il y en a une
            VehicleAssignment::where('vehicle_id', $vehicle->id)
                ->whereNull('end_date')
                ->update([
                    'end_date' => now()->toDateString(),
                    'end_mileage' => $vehicle->current_mileage,
                ]);

            $assignment = VehicleAssignment::create($data + ['vehicle_id' => $vehicle->id]);
            return response()->json(['data' => $assignment->load('employee:id,name')], 201);
        });
    }

    public function unassign(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'end_mileage' => ['nullable', 'integer', 'min:0'],
        ]);
        VehicleAssignment::where('vehicle_id', $vehicle->id)
            ->whereNull('end_date')
            ->update([
                'end_date' => now()->toDateString(),
                'end_mileage' => $data['end_mileage'] ?? $vehicle->current_mileage,
            ]);
        return ['data' => ['released' => true]];
    }

    // ========== MAINTENANCES ==========

    public function listMaintenances(Request $request, Vehicle $vehicle)
    {
        return ['data' => $vehicle->maintenances()->orderByDesc('performed_at')->paginate(50)];
    }

    public function createMaintenance(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'type' => ['required', 'in:revision,inspection,tire,oil_change,repair,other'],
            'performed_at' => ['required', 'date'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'provider' => ['nullable', 'string', 'max:128'],
            'description' => ['nullable', 'string'],
            'next_due_at' => ['nullable', 'date'],
        ]);

        return DB::transaction(function () use ($vehicle, $data) {
            $maint = VehicleMaintenance::create($data + ['vehicle_id' => $vehicle->id]);
            // Maj kilométrage si supérieur
            if (! empty($data['mileage']) && $data['mileage'] > $vehicle->current_mileage) {
                $vehicle->update(['current_mileage' => $data['mileage']]);
            }
            // Maj prochaine échéance CT
            if ($data['type'] === 'inspection' && ! empty($data['next_due_at'])) {
                $vehicle->update(['next_inspection_at' => $data['next_due_at']]);
            }
            return response()->json(['data' => $maint], 201);
        });
    }

    // ========== INCIDENTS ==========

    public function listIncidents(Request $request, Vehicle $vehicle)
    {
        return ['data' => $vehicle->incidents()->with('employee:id,name')->orderByDesc('incident_at')->paginate(50)];
    }

    public function createIncident(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'employee_id' => ['nullable', 'exists:employees,id'],
            'incident_at' => ['required', 'date'],
            'type' => ['required', 'in:accident,breakdown,theft,vandalism,other'],
            'severity' => ['nullable', 'in:minor,moderate,major'],
            'description' => ['required', 'string'],
            'repair_cost' => ['nullable', 'numeric', 'min:0'],
            'insurance_claim_ref' => ['nullable', 'string', 'max:64'],
        ]);
        $incident = VehicleIncident::create($data + ['vehicle_id' => $vehicle->id, 'status' => 'open']);
        return response()->json(['data' => $incident->load('employee:id,name')], 201);
    }

    /**
     * Récapitulatif flotte : alertes (assurance, CT, sinistres ouverts).
     */
    public function alerts(Request $request)
    {
        return ['data' => [
            'insurance_expiring' => Vehicle::where('status', 'active')
                ->whereNotNull('insurance_expires_at')
                ->where('insurance_expires_at', '<=', now()->addDays(30))
                ->get(['id', 'license_plate', 'brand', 'model', 'insurance_expires_at']),
            'inspection_due' => Vehicle::where('status', 'active')
                ->whereNotNull('next_inspection_at')
                ->where('next_inspection_at', '<=', now()->addDays(30))
                ->get(['id', 'license_plate', 'brand', 'model', 'next_inspection_at']),
            'open_incidents' => VehicleIncident::whereIn('status', ['open', 'in_repair'])
                ->with('vehicle:id,license_plate')->count(),
        ]];
    }
}
