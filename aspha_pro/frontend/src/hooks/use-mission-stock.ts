import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Produits de stock / consommables rattachés à une mission (2026-05-21).
 *
 * RÈGLE MÉTIER : ajouter une ligne avec un `stock_product_id` décompte
 * immédiatement le stock côté serveur (mouvement de sortie). La supprimer
 * ré-incrémente. Une ligne libre (`stock_product_id` null) ne touche pas
 * le stock. Toute la logique de mouvement est côté backend.
 */

export type MissionStockItem = {
  id: number;
  mission_id: number;
  stock_product_id: number | null;
  label: string;
  quantity: string | number;
  unit_price: string | number;
  stock_product?: {
    id: number;
    name: string;
    reference: string | null;
    unit: string | null;
    current_quantity: number;
  } | null;
};

export type MissionStockItemPayload = {
  stock_product_id: number | null;
  label: string;
  quantity: number;
  unit_price: number;
};

type ListResponse<T> = { data: T[] };
type ItemResponse = { data: MissionStockItem; low_stock?: boolean };

/** Invalide la liste des produits de la mission + le cache stock global. */
function invalidate(qc: ReturnType<typeof useQueryClient>, missionId: number) {
  qc.invalidateQueries({ queryKey: ["mission", missionId, "stock-items"] });
  // Le décompte a modifié les quantités de stock → rafraîchir les vues stock.
  qc.invalidateQueries({ queryKey: ["stock"] });
}

export function useMissionStockItems(missionId: number | null) {
  return useQuery({
    queryKey: ["mission", missionId, "stock-items"],
    queryFn: async () =>
      (await api.get<ListResponse<MissionStockItem>>(`/missions/${missionId}/stock-items`)).data.data,
    enabled: !!missionId,
  });
}

export function useCreateMissionStockItem(missionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MissionStockItemPayload) =>
      (await api.post<ItemResponse>(`/missions/${missionId}/stock-items`, payload)).data,
    onSuccess: () => invalidate(qc, missionId),
  });
}

export function useUpdateMissionStockItem(missionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<MissionStockItemPayload> & { id: number }) =>
      (await api.patch<ItemResponse>(`/missions/${missionId}/stock-items/${id}`, payload)).data,
    onSuccess: () => invalidate(qc, missionId),
  });
}

export function useDeleteMissionStockItem(missionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/missions/${missionId}/stock-items/${id}`);
    },
    onSuccess: () => invalidate(qc, missionId),
  });
}
