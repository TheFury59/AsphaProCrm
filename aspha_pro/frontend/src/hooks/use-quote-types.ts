// 2026-05-20 refonte devis — hooks CRUD des types de devis (table `quote_types`).
// Backend : QuoteTypeController (apiResource /quote-types). DELETE = désactivation.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Type
// =========================================================================

export type QuoteTypeNature = "regular" | "punctual";
export type QuoteCalculation = "per_week" | "per_month" | "per_unit";

/**
 * Un type de devis = modèle pré-paramétré (modalité, nature, mode/rythme de
 * facturation, durée d'engagement, acompte) sélectionnable à la création d'un
 * devis pour pré-remplir ces réglages.
 */
export type QuoteType = {
  id: number;
  entity_id: number | null;
  label: string;
  modality: string | null;
  nature: QuoteTypeNature | null;
  billing_mode: string | null;
  quote_calculation: QuoteCalculation | null;
  commitment_duration: string | null;
  billing_rhythm: string | null;
  deposit_percent: number | string | null;
  status: "active" | "inactive";
  entity?: { id: number; name: string } | null;
};

type ListResp<T> = { data: T[] };
type Single<T> = { data: T };

// =========================================================================
// Hooks
// =========================================================================

type QuoteTypeListParams = { status?: "active" | "inactive"; entity_id?: number };

export function useQuoteTypes(params: QuoteTypeListParams = {}) {
  return useQuery({
    queryKey: ["quote-types", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      if (params.entity_id) qs.set("entity_id", String(params.entity_id));
      const res = await api.get<ListResp<QuoteType>>(`/quote-types?${qs}`);
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

export function useCreateQuoteType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<QuoteType>) =>
      (await api.post<Single<QuoteType>>("/quote-types", payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote-types"], refetchType: "active" }),
  });
}

export function useUpdateQuoteType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<QuoteType> }) =>
      (await api.patch<Single<QuoteType>>(`/quote-types/${id}`, patch)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote-types"], refetchType: "active" }),
  });
}

export function useDeleteQuoteType() {
  const qc = useQueryClient();
  return useMutation({
    // DELETE backend = désactivation (status -> inactive), pas de suppression physique.
    mutationFn: async (id: number) => { await api.delete(`/quote-types/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote-types"], refetchType: "active" }),
  });
}
