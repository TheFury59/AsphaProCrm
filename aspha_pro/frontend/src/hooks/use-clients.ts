import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Client, Paginated, Single } from "@/types/api";

type ClientListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
};

export function useClients(params: ClientListParams = {}) {
  return useQuery({
    queryKey: ["clients", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      const res = await api.get<Paginated<Client>>(`/clients?${qs}`);
      return res.data;
    },
    staleTime: 15_000,
  });
}

export function useClient(id: number | null) {
  return useQuery({
    queryKey: ["clients", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<Single<Client>>(`/clients/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Client> & { company: Partial<Client["company"]>; billing_contact?: Partial<Client["billing_contact"]> }) => {
      const res = await api.post<Single<Client>>("/clients", payload);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Client> & { company?: Partial<Client["company"]>; billing_contact?: Partial<Client["billing_contact"]> } }) => {
      const res = await api.patch<Single<Client>>(`/clients/${id}`, patch);
      return res.data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients", vars.id] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}
