import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Vehicle = {
  id: number;
  entity_id: number | null;
  license_plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  fuel_type: "gasoline" | "diesel" | "electric" | "hybrid" | null;
  current_mileage: number;
  purchase_date: string | null;
  insurance_expires_at: string | null;
  next_inspection_at: string | null;
  status: "active" | "maintenance" | "sold" | "scrapped";
  notes: string | null;
  current_assignment?: { id: number; employee: { id: number; name: string } } | null;
  [k: string]: any;
};

export type VehicleMaintenance = {
  id: number;
  vehicle_id: number;
  type: "revision" | "inspection" | "tire" | "oil_change" | "repair" | "other";
  performed_at: string;
  mileage: number | null;
  cost: number | null;
  provider: string | null;
  description: string | null;
  next_due_at: string | null;
};

export type VehicleIncident = {
  id: number;
  vehicle_id: number;
  employee_id: number | null;
  incident_at: string;
  type: "accident" | "breakdown" | "theft" | "vandalism" | "other";
  severity: "minor" | "moderate" | "major";
  description: string;
  repair_cost: number | null;
  status: "open" | "in_repair" | "resolved" | "written_off";
};

export function useVehicles(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ["fleet", "vehicles", params],
    queryFn: async () => {
      const { data } = await api.get("/fleet/vehicles", { params });
      return data.data as { data: Vehicle[]; meta?: any };
    },
  });
}

export function useVehicle(id: number | null) {
  return useQuery({
    queryKey: ["fleet", "vehicle", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/fleet/vehicles/${id}`);
      return data.data as Vehicle & {
        assignments: any[];
        maintenances: VehicleMaintenance[];
        incidents: VehicleIncident[];
      };
    },
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Vehicle>) => {
      const { data } = await api.post<{ data: Vehicle }>("/fleet/vehicles", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Vehicle> }) => {
      const { data } = await api.patch<{ data: Vehicle }>(`/fleet/vehicles/${id}`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });
}

export function useAssignVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, payload }: { vehicleId: number; payload: any }) => {
      const { data } = await api.post(`/fleet/vehicles/${vehicleId}/assign`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, payload }: { vehicleId: number; payload: any }) => {
      const { data } = await api.post(`/fleet/vehicles/${vehicleId}/maintenances`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, payload }: { vehicleId: number; payload: any }) => {
      const { data } = await api.post(`/fleet/vehicles/${vehicleId}/incidents`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });
}

export function useFleetAlerts() {
  return useQuery({
    queryKey: ["fleet", "alerts"],
    queryFn: async () => {
      const { data } = await api.get("/fleet/alerts");
      return data.data as {
        insurance_expiring: any[];
        inspection_due: any[];
        open_incidents: number;
      };
    },
  });
}

// === Matching ===
export type MatchingCandidate = {
  employee_id: number;
  employee_name: string;
  score: number;
  breakdown: {
    skills: number;
    proximity: number;
    availability: number;
    preference: number;
    distance_km: number | null;
  };
};

export function useMatchingSuggestions(interventionId: number | null) {
  return useQuery({
    queryKey: ["matching", "suggest", interventionId],
    enabled: !!interventionId,
    queryFn: async () => {
      const { data } = await api.get<{ data: MatchingCandidate[] }>(
        `/interventions/${interventionId}/match`,
      );
      return data.data;
    },
  });
}
