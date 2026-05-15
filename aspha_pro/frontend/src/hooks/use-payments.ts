import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Reglement = {
  id: number;
  reference: string;
  type: string;
  status: string;
  client_id: number;
  entity_id: number;
  amount: number;
  payment_method: string;
  operation_date: string;
  value_date: string | null;
  description: string | null;
  ventilation_status: "unallocated" | "partial" | "allocated";
  client?: { id: number; company?: { company_name?: string | null } | null } | null;
  reglement_invoice_lines?: { id: number; invoice_id: number; allocated_amount: number; invoice?: { id: number; reference: string; total: number; invoice_date?: string; status?: string; payment_status?: string } | null }[];
};

type ListResp<T> = { data: T[]; meta?: any };
type Single<T> = { data: T };

export function useReglements(params: { page?: number; per_page?: number; search?: string; payment_method?: string; ventilation_status?: string } = {}) {
  return useQuery({
    queryKey: ["reglements", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.payment_method) qs.set("filter[payment_method]", params.payment_method);
      if (params.ventilation_status) qs.set("filter[ventilation_status]", params.ventilation_status);
      const res = await api.get<ListResp<Reglement>>(`/reglements?${qs}`);
      return res.data;
    },
  });
}

export function useReglement(id: number | null) {
  return useQuery({
    queryKey: ["reglements", id],
    enabled: !!id,
    queryFn: async () => (await api.get<Single<Reglement>>(`/reglements/${id}`)).data.data,
  });
}

export function useAllocateReglement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reglementId, invoice_id, amount }: { reglementId: number; invoice_id: number; amount: number }) =>
      (await api.post(`/reglements/${reglementId}/allocate`, { invoice_id, amount })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useCreateReglement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post<Single<Reglement>>("/reglements", payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteReglement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/reglements/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// Pennylane sync
export function useSyncInvoicePennylane() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: number) =>
      (await api.post(`/invoices/${invoiceId}/sync-pennylane`)).data.data as { pennylane_id: string; pennylane_synced_at: string; mock: boolean },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useSyncQuotePennylane() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: number) =>
      (await api.post(`/quotes/${quoteId}/sync-pennylane`)).data.data as { pennylane_id: string; pennylane_synced_at: string; mock: boolean },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

// Exceptions de récurrence
export function useCreateInterventionException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentId, payload }: { parentId: number; payload: any }) =>
      (await api.post(`/interventions/${parentId}/exceptions`, payload)).data.data,
    onSuccess: () => {
      // Invalide tous les caches dépendants pour rafraîchir le calendar
      // ET les panneaux latéraux (trajets, contrats, absences) en même temps.
      qc.invalidateQueries({ queryKey: ["interventions"] });
      qc.invalidateQueries({ queryKey: ["planning"] });
      qc.invalidateQueries({ queryKey: ["matching"] });
    },
  });
}
