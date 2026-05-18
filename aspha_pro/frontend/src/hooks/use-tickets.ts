import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Types
// =========================================================================

export type TicketType = "complaint" | "problem_report" | "consumable_reorder";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type ClientRequest = {
  id: number;
  client_id: number;
  type: TicketType;
  subject: string | null;
  body: string | null;
  status: TicketStatus;
  priority: TicketPriority | null;
  assigned_to: number | null;
  resolved_at: string | null;
  created_at: string;
  client?: {
    id: number;
    code: string;
    company?: { id: number; company_name: string; logo_url: string | null } | null;
  };
  assigned_to_user?: { id: number; name: string } | null;
  assignedTo?: { id: number; name: string } | null;
};

type ListResponse<T> = { data: { data: T[]; total: number; current_page: number; last_page: number; per_page: number } };
type SingleResponse<T> = { data: T };

// =========================================================================
// List + filters
// =========================================================================

export type TicketListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: TicketStatus | "";
  type?: TicketType | "";
  priority?: TicketPriority | "";
  client_id?: number;
};

export function useTickets(params: TicketListParams = {}) {
  return useQuery({
    queryKey: ["client-requests", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      if (params.type) qs.set("filter[type]", params.type);
      if (params.priority) qs.set("filter[priority]", params.priority);
      if (params.client_id) qs.set("filter[client_id]", String(params.client_id));
      const res = await api.get<ListResponse<ClientRequest>>(`/client-requests?${qs}`);
      const p: any = (res.data as any).data ?? res.data;
      return {
        data: (p.data ?? []) as ClientRequest[],
        meta: {
          total: p.total ?? 0,
          current_page: p.current_page ?? 1,
          last_page: p.last_page ?? 1,
          per_page: p.per_page ?? 25,
        },
      };
    },
  });
}

export function useTicket(id: number | null) {
  return useQuery({
    queryKey: ["client-requests", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<SingleResponse<ClientRequest>>(`/client-requests/${id}`)).data.data,
  });
}

// =========================================================================
// Mutations
// =========================================================================

function invalidateTickets(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["client-requests"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ClientRequest>) =>
      (await api.post<SingleResponse<ClientRequest>>("/client-requests", payload)).data.data,
    onSuccess: () => invalidateTickets(qc),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<ClientRequest> }) =>
      (await api.patch<SingleResponse<ClientRequest>>(`/client-requests/${id}`, patch)).data.data,
    onSuccess: () => invalidateTickets(qc),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/client-requests/${id}`);
    },
    onSuccess: () => invalidateTickets(qc),
  });
}
