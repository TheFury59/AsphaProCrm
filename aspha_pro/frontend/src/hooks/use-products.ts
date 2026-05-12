import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Paginated, Product, Single } from "@/types/api";

type ProductListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  category_id?: number;
  type?: string;
  status?: string;
};

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.category_id) qs.set("filter[category_id]", String(params.category_id));
      if (params.type) qs.set("filter[type]", params.type);
      if (params.status) qs.set("filter[status]", params.status);
      const res = await api.get<Paginated<Product>>(`/products?${qs}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: ["products", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<Single<Product>>(`/products/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Product>) => {
      const res = await api.post<Single<Product>>("/products", payload);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Product> }) => {
      const res = await api.patch<Single<Product>>(`/products/${id}`, patch);
      return res.data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products", vars.id] });
    },
  });
}
