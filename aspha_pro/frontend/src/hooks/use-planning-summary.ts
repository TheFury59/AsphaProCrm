import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ContractSummary = {
  employee_id: number;
  employee_name: string;
  position: string | null;
  contract_weekly_hours: number;
  contract_window_hours: number;
  planned_hours: number;
  available_hours: number;
  fill_rate_pct: number;
  over_quota: boolean;
};

export type LongAbsence = {
  id: number;
  kind: "employee" | "client";
  person_id: number;
  person_name: string;
  start_date: string;
  end_date: string | null;
  reason_label: string | null;
  days: number;
};

export function useContractSummary(params: { from: string; to: string; employee_id?: number | null }) {
  return useQuery({
    queryKey: ["planning", "contract-summary", params],
    queryFn: async () => {
      const { data } = await api.get<{ data: ContractSummary[] }>("/planning/contract-summary", { params });
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useLongAbsences(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ["planning", "long-absences", params],
    queryFn: async () => {
      const { data } = await api.get<{ data: LongAbsence[]; threshold_days: number }>(
        "/planning/long-absences",
        { params },
      );
      return data;
    },
    staleTime: 30_000,
  });
}

export type PublicSettings = {
  long_absence_threshold_days: number;
  paid_travel_max_minutes: number;
  badge_late_threshold_minutes: number;
  stock_alert_default_threshold: number;
  silae_portal_url: string | null;
  silae_api_enabled: boolean;
  google_maps_enabled: boolean;
  pennylane_enabled: boolean;
};

export type TripWaypoint = {
  label: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Trip = {
  employee_id: number;
  employee_name: string | null;
  /** true = trajet "domicile → 1er RDV de la journée", jamais payé */
  is_home_origin: boolean;
  from_event_id: string | null;
  to_event_id: string;
  from_address: TripWaypoint;
  to_address: TripWaypoint;
  from_end: string | null;
  to_start: string;
  gap_minutes: number;
  distance_km: number | null;
  duration_minutes: number | null;
  is_paid: boolean;
  source: "gmaps" | "haversine" | null;
};

export type TripSummary = {
  employee_id: number;
  employee_name: string | null;
  paid_trips: number;
  paid_distance_km: number;
  paid_duration_minutes: number;
  unpaid_trips: number;
  unpaid_distance_km: number;
  unpaid_duration_minutes: number;
};

export type TripDiagnostics = {
  total_events: number;
  unassigned_events: number;
  events_without_geocoded_address: number;
};

export function useTrips(params: { from: string; to: string; employee_id?: number | null }) {
  return useQuery({
    queryKey: ["planning", "trips", params],
    queryFn: async () => {
      const { data } = await api.get<{ data: {
        trips: Trip[];
        summary: TripSummary[];
        paid_threshold_minutes: number;
        diagnostics: TripDiagnostics;
      } }>(
        "/planning/trips", { params },
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

export type AvailableEmployee = {
  employee_id: number;
  employee_name: string;
  employee_lat: number | null;
  employee_lng: number | null;
  has_conflict: boolean;
  conflicts: Array<{
    intervention_id: number;
    client_code: string | null;
    start_time: string | null;
    end_time: string | null;
    status: string | null;
  }>;
  distance_km: number | null;
  duration_minutes: number | null;
  source: "gmaps" | "haversine" | null;
};

export function useAvailableEmployees(params: {
  start_datetime: string;
  end_datetime: string;
  client_id: number | null;
} | null) {
  return useQuery({
    queryKey: ["planning", "available-employees", params],
    enabled: !!params && !!params.client_id,
    queryFn: async () => {
      const { data } = await api.get<{ data: { candidates: AvailableEmployee[]; client_address: any } }>(
        "/planning/available-employees", { params: params! },
      );
      return data.data;
    },
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: ["settings", "public"],
    queryFn: async () => {
      const { data } = await api.get<{ data: PublicSettings }>("/settings/public");
      return data.data;
    },
    staleTime: 5 * 60_000,  // 5 min
  });
}
