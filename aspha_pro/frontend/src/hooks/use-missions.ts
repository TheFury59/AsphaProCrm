import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Types
// =========================================================================

export type MissionStatus = "active" | "suspended" | "cancelled";

export type Prestation = {
  id: number;
  client_id: number;
  mission_id: number | null;
  product_id: number | null;
  quote_id: number | null;
  label: string;
  start_date: string | null;
  end_date: string | null;
  billing_type: string | null;
  pricing_type: "default" | "custom" | null;
  custom_price: string | number | null;
  base_price: string | number | null;
  no_intervention_no_bill: boolean;
  product?: { id: number; name: string; code: string; price: string | number; default_duration_minutes: number | null };
  quote?: { id: number; reference: string };
};

export type Mission = {
  id: number;
  client_id: number;
  quote_id: number | null;
  name: string;
  status: MissionStatus;
  no_intervention_no_bill: boolean;
  payment_methods: string | null;
  online_payment_enabled: boolean;
  billing_rhythm: string | null;
  created_at?: string;
  client_prestations?: Prestation[];
  quote?: { id: number; reference: string };
};

type ListResponse<T> = { data: T[] };
type SingleResponse<T> = { data: T };

// =========================================================================
// Cascade invalidation : missions ↔ client ↔ planning ↔ devis
// =========================================================================

function invalidateMissionCascade(qc: ReturnType<typeof useQueryClient>, clientId?: number, missionId?: number) {
  if (clientId) qc.invalidateQueries({ queryKey: ["client", clientId, "missions"] });
  if (missionId) qc.invalidateQueries({ queryKey: ["mission", missionId] });
  qc.invalidateQueries({ queryKey: ["clients"] });
  qc.invalidateQueries({ queryKey: ["interventions"] });
  qc.invalidateQueries({ queryKey: ["planning"] });
  qc.invalidateQueries({ queryKey: ["quotes"] });
}

// =========================================================================
// MISSIONS
// =========================================================================

export function useClientMissions(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "missions"],
    queryFn: async () =>
      (await api.get<ListResponse<Mission>>(`/clients/${clientId}/missions`)).data.data,
    enabled: !!clientId,
  });
}

export function useMission(missionId: number | null) {
  return useQuery({
    queryKey: ["mission", missionId],
    queryFn: async () =>
      (await api.get<SingleResponse<Mission>>(`/missions/${missionId}`)).data.data,
    enabled: !!missionId,
  });
}

export function useCreateMission(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Mission>) =>
      (await api.post<SingleResponse<Mission>>(`/clients/${clientId}/missions`, payload)).data.data,
    onSuccess: () => invalidateMissionCascade(qc, clientId),
  });
}

export function useUpdateMission(missionId: number, clientId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Mission>) =>
      (await api.patch<SingleResponse<Mission>>(`/missions/${missionId}`, payload)).data.data,
    onSuccess: () => invalidateMissionCascade(qc, clientId, missionId),
  });
}

export function useDeleteMission(clientId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (missionId: number) => {
      await api.delete(`/missions/${missionId}`);
    },
    onSuccess: () => invalidateMissionCascade(qc, clientId),
  });
}

// =========================================================================
// PRESTATIONS (nested under mission)
// =========================================================================

export function useMissionPrestations(missionId: number | null) {
  return useQuery({
    queryKey: ["mission", missionId, "prestations"],
    queryFn: async () =>
      (await api.get<ListResponse<Prestation>>(`/missions/${missionId}/prestations`)).data.data,
    enabled: !!missionId,
  });
}

export function useCreatePrestation(missionId: number, clientId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Prestation>) =>
      (await api.post<SingleResponse<Prestation>>(`/missions/${missionId}/prestations`, payload)).data.data,
    onSuccess: () => invalidateMissionCascade(qc, clientId, missionId),
  });
}

export function useUpdatePrestation(missionId: number, clientId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Prestation> & { id: number }) =>
      (await api.patch<SingleResponse<Prestation>>(`/missions/${missionId}/prestations/${id}`, payload)).data.data,
    onSuccess: () => invalidateMissionCascade(qc, clientId, missionId),
  });
}

export function useDeletePrestation(missionId: number, clientId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prestationId: number) => {
      await api.delete(`/missions/${missionId}/prestations/${prestationId}`);
    },
    onSuccess: () => invalidateMissionCascade(qc, clientId, missionId),
  });
}
