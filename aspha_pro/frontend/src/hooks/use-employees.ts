import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Employee, Paginated, Single } from "@/types/api";

type EmployeeListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  classification?: string;
  entity_id?: number;
};

export function useEmployees(params: EmployeeListParams = {}) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.classification) qs.set("filter[classification]", params.classification);
      if (params.entity_id) qs.set("filter[entity_id]", String(params.entity_id));
      const res = await api.get<Paginated<Employee>>(`/employees?${qs}`);
      return res.data;
    },
    staleTime: 15_000,
  });
}

export function useEmployee(id: number | null) {
  return useQuery({
    queryKey: ["employees", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<Single<Employee>>(`/employees/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Employee> & { skill_ids?: number[] }) => {
      const res = await api.post<Single<Employee>>("/employees", payload);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Employee> & { skill_ids?: number[] } }) => {
      const res = await api.patch<Single<Employee>>(`/employees/${id}`, patch);
      return res.data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees", vars.id] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}
