import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Entité administrative (agence / société). Distinct du hook `useEntities`
 * de `use-products.ts` qui n'expose qu'id+name+siret pour les sélecteurs :
 * ici on a tous les champs éditables depuis la page « Mon entreprise ».
 */
export type EntityCompany = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  siret: string | null;
  vat_number: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "active" | "inactive";
  modulation_enabled: boolean;
  annualisation_enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export function useEntityCompanies() {
  return useQuery({
    queryKey: ["entity-companies"],
    queryFn: async () => {
      const { data } = await api.get<{ data: EntityCompany[] }>("/entities");
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useUpdateEntityCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<EntityCompany> }) => {
      const { data } = await api.patch<{ data: EntityCompany }>(`/entities/${id}`, patch);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entity-companies"] });
      // Invalide aussi le sélecteur d'entités utilisé ailleurs (création client/employé)
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}
