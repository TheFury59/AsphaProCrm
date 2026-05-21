import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Types
// =========================================================================

export type MissionStatus = "active" | "suspended" | "cancelled";

/** Nature de la prestation contractualisée (portée par le contrat, pas le catalogue). */
export type PrestationNature = "regular" | "punctual";

/** Fréquence de récurrence — aligné sur le moteur InterventionExpander. */
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

/** Type de fin de récurrence. */
export type RecurrenceEndType = "never" | "on_date" | "after_occurrences";

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
  // Nature + récurrence (refonte 2026-05-21)
  nature: PrestationNature | null;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  recurrence_days_of_week: string | null;
  recurrence_start_time: string | null;
  recurrence_end_time: string | null;
  recurrence_end_type: RecurrenceEndType | null;
  recurrence_occurrences_count: number | null;
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

/**
 * Liste GLOBALE paginée des missions (pour la page menu /missions).
 * Filtres : status, client_id, search (sur nom mission OU raison sociale).
 */
export type AllMissionsParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: MissionStatus | "";
  client_id?: number;
};

export function useAllMissions(params: AllMissionsParams = {}) {
  return useQuery({
    queryKey: ["missions", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      if (params.client_id) qs.set("filter[client_id]", String(params.client_id));
      const res = await api.get<any>(`/missions?${qs}`);
      // Le controller renvoie ['data' => $paginate] → on dé-wrap comme ailleurs
      const body = res.data;
      const p = body?.data ?? body;
      return {
        data: (p?.data ?? []) as Mission[],
        meta: {
          total: p?.total ?? 0,
          current_page: p?.current_page ?? 1,
          last_page: p?.last_page ?? 1,
          per_page: p?.per_page ?? 25,
        },
      };
    },
  });
}

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

/**
 * Payload de création d'une prestation dans le batch create d'une mission.
 * Les champs IDs (mission_id, client_id) sont injectés côté serveur.
 */
export type PrestationDraft = {
  product_id?: number | null;
  label: string;
  start_date?: string | null;
  end_date?: string | null;
  billing_type?: "hourly" | "forfait" | "frais" | "remise" | "carte" | "exceptional" | null;
  pricing_type?: "default" | "custom" | null;
  custom_price?: number | null;
  base_price?: number | null;
  no_intervention_no_bill?: boolean;
  // Nature + récurrence (refonte 2026-05-21)
  nature?: PrestationNature | null;
  recurrence_frequency?: RecurrenceFrequency | null;
  recurrence_interval?: number | null;
  recurrence_days_of_week?: string | null;
  recurrence_start_time?: string | null;
  recurrence_end_time?: string | null;
  recurrence_end_type?: RecurrenceEndType | null;
  recurrence_occurrences_count?: number | null;
};

/**
 * Payload de création de mission complète (Xelya-style) :
 * 1 page → 1 mission + N prestations contractualisées en une seule requête.
 */
export type CreateMissionPayload = Partial<Mission> & {
  prestations?: PrestationDraft[];
};

export function useCreateMission(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateMissionPayload) =>
      (await api.post<SingleResponse<Mission>>(`/clients/${clientId}/missions`, payload)).data.data,
    onSuccess: () => invalidateMissionCascade(qc, clientId),
  });
}

/**
 * Devis du client (pour les sélecteurs : rattacher une mission à un devis).
 * Tape directement le filtre Spatie `filter[client_id]` sur /quotes.
 */
export function useClientQuotes(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "quotes"],
    queryFn: async () => {
      const res = await api.get(`/quotes?filter[client_id]=${clientId}&per_page=100`);
      // Le controller Quote renvoie ['data' => $paginate] → on dé-wrap
      const body: any = res.data;
      return (body?.data?.data ?? body?.data ?? []) as Array<{
        id: number;
        reference: string | null;
        quote_date: string;
        status: string;
        total: number;
      }>;
    },
    enabled: !!clientId,
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
