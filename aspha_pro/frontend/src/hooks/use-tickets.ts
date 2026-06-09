import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Types
// =========================================================================

export type TicketType = "complaint" | "problem_report" | "consumable_reorder";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type TicketAssignedEmployee = {
  id: number;
  name: string | null;
  user_id: number | null;
  avatar_url?: string | null;
};

export type ClientRequest = {
  id: number;
  client_id: number;
  type: TicketType;
  subject: string | null;
  body: string | null;
  status: TicketStatus;
  priority: TicketPriority | null;
  assigned_to: number | null;
  created_by_user_id: number | null;
  resolved_at: string | null;
  created_at: string;
  // Levier « faute » du système de notation : intervenant désigné responsable.
  fault_employee_id: number | null;
  fault_comment: string | null;
  client?: {
    id: number;
    code: string;
    company?: { id: number; company_name: string; logo_url: string | null } | null;
  };
  // Relations sérialisées en snake_case par Eloquent (toArray).
  assigned_to_user?: { id: number; name: string } | null;
  assignedTo?: { id: number; name: string } | null;
  created_by_user?: { id: number; name: string } | null;
  assigned_employees?: TicketAssignedEmployee[];
  fault_employee?: { id: number; name: string | null; avatar_url?: string | null } | null;
};

/** Un message du fil de discussion d'un ticket. */
export type TicketMessage = {
  id: number;
  client_request_id: number;
  sender_id: number | null;
  body: string;
  created_at: string;
  sender?: { id: number; name: string; avatar_url?: string | null } | null;
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

// =========================================================================
// Fil de discussion (admin)
// =========================================================================

export function useTicketMessages(ticketId: number | null) {
  return useQuery({
    queryKey: ["client-requests", ticketId, "messages"],
    enabled: !!ticketId,
    queryFn: async () =>
      (await api.get<SingleResponse<TicketMessage[]>>(`/client-requests/${ticketId}/messages`)).data.data,
    // Polling 5 s pour effet « live » sans WebSocket — sans ca, l'admin doit
    // refresh la page pour voir un nouveau message envoye depuis le mobile.
    // staleTime 2 s pour absorber les re-render frequents sans burst de
    // requetes. refetchOnWindowFocus pour reload immediat quand l'admin
    // revient sur l'onglet.
    refetchInterval: 5_000,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
  });
}

export function usePostTicketMessage(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      (await api.post<SingleResponse<TicketMessage>>(`/client-requests/${ticketId}/messages`, { body }))
        .data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests", ticketId, "messages"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// =========================================================================
// Affectation d'intervenant(s)
// =========================================================================

export function useAttachTicketEmployee(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: number) =>
      (await api.post<SingleResponse<TicketAssignedEmployee[]>>(
        `/client-requests/${ticketId}/employees`,
        { employee_id: employeeId },
      )).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests", ticketId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDetachTicketEmployee(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: number) =>
      (await api.delete<SingleResponse<TicketAssignedEmployee[]>>(
        `/client-requests/${ticketId}/employees/${employeeId}`,
      )).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests", ticketId] });
    },
  });
}

// =========================================================================
// Désignation de la faute (système de notation)
// =========================================================================

/**
 * Définit ou retire l'intervenant fautif d'un ticket. Passe par l'endpoint
 * `update` du ticket (qui accepte `fault_employee_id` / `fault_comment`).
 * `fault_employee_id: null` retire la faute (et purge le commentaire côté
 * backend). Invalide la note de l'intervenant concerné (critère « relation »).
 */
export function useSetTicketFault(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { fault_employee_id: number | null; fault_comment: string | null }) =>
      (await api.patch<SingleResponse<ClientRequest>>(`/client-requests/${ticketId}`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests", ticketId] });
      // La note des intervenants dépend des tickets fautifs → on rafraîchit.
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

/** Tickets liés à un intervenant (affectés OU créés) — onglet fiche intervenant. */
export function useEmployeeTickets(employeeId: number | null) {
  return useQuery({
    queryKey: ["employees", employeeId, "client-requests"],
    enabled: !!employeeId,
    queryFn: async () =>
      (await api.get<SingleResponse<ClientRequest[]>>(`/employees/${employeeId}/client-requests`)).data.data,
  });
}
