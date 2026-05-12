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
  client?: { id: number; client_companies?: any[] } | null;
  reglement_invoice_lines?: { id: number; invoice_id: number; allocated_amount: number; invoice?: any }[];
};

type ListResp<T> = { data: T[]; meta?: any };
type Single<T> = { data: T };

export function useReglements(params: { page?: number; per_page?: number } = {}) {
  return useQuery({
    queryKey: ["reglements", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      const res = await api.get<ListResp<Reglement>>(`/reglements?${qs}`);
      return res.data;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
  });
}
