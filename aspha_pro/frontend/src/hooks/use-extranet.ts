import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useIntervenantProfile() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "profile"],
    queryFn: async () => (await api.get("/extranet/intervenant/profile")).data.data,
  });
}

export function useIntervenantPlanning(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ["extranet", "intervenant", "planning", params],
    queryFn: async () => (await api.get("/extranet/intervenant/planning", { params })).data.data,
    staleTime: 30_000,
  });
}

export function useIntervenantAbsences() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "absences"],
    queryFn: async () => (await api.get("/extranet/intervenant/absences")).data.data,
  });
}

export function useIntervenantContract() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "contract"],
    queryFn: async () => (await api.get("/extranet/intervenant/contract")).data.data,
  });
}

// === Client extranet ===

export function useClientProfile() {
  return useQuery({
    queryKey: ["extranet", "client", "profile"],
    queryFn: async () => (await api.get("/extranet/client/profile")).data.data,
  });
}

export function useClientInvoices() {
  return useQuery({
    queryKey: ["extranet", "client", "invoices"],
    queryFn: async () => (await api.get("/extranet/client/invoices")).data.data,
  });
}

export function useClientQuotes() {
  return useQuery({
    queryKey: ["extranet", "client", "quotes"],
    queryFn: async () => (await api.get("/extranet/client/quotes")).data.data,
  });
}

/**
 * Validation d'un devis par le client depuis l'extranet : `sent` → `accepted`.
 * Le backend vérifie l'ownership (le devis appartient bien à ce client).
 */
export function useAcceptClientQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: number) =>
      (await api.post(`/extranet/client/quotes/${quoteId}/accept`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extranet", "client", "quotes"] });
    },
  });
}

/** Refus d'un devis par le client : `sent` → `refused`. */
export function useRefuseClientQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: number) =>
      (await api.post(`/extranet/client/quotes/${quoteId}/refuse`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extranet", "client", "quotes"] });
    },
  });
}

export function useClientPrestations() {
  return useQuery({
    queryKey: ["extranet", "client", "prestations"],
    queryFn: async () => (await api.get("/extranet/client/prestations")).data.data,
  });
}

// === Tickets (vue extranet client) ===

export function useClientTickets() {
  return useQuery({
    queryKey: ["extranet", "client", "tickets"],
    queryFn: async () => (await api.get("/extranet/client/tickets")).data.data,
  });
}

export function useCreateClientTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type: "complaint" | "problem_report" | "consumable_reorder";
      subject: string;
      body?: string;
      priority?: "low" | "normal" | "high" | "urgent";
    }) => (await api.post("/extranet/client/tickets", payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extranet", "client", "tickets"] });
    },
  });
}

/** Fil de discussion d'un ticket côté extranet client. */
export function useClientTicketMessages(ticketId: number | null) {
  return useQuery({
    queryKey: ["extranet", "client", "tickets", ticketId, "messages"],
    enabled: !!ticketId,
    queryFn: async () =>
      (await api.get(`/extranet/client/tickets/${ticketId}/messages`)).data.data,
  });
}

export function usePostClientTicketMessage(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      (await api.post(`/extranet/client/tickets/${ticketId}/messages`, { body })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extranet", "client", "tickets", ticketId, "messages"] });
    },
  });
}

// === Intervenant : tickets signalements + mes clients ===

export function useIntervenantTickets() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "tickets"],
    queryFn: async () => (await api.get("/extranet/intervenant/tickets")).data.data,
  });
}

export function useIntervenantMyClients() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "my-clients"],
    queryFn: async () => (await api.get("/extranet/intervenant/my-clients")).data.data,
  });
}

export function useCreateIntervenantTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      client_id: number;
      type: "complaint" | "problem_report" | "consumable_reorder";
      subject: string;
      body?: string;
      priority?: "low" | "normal" | "high" | "urgent";
    }) => (await api.post("/extranet/intervenant/tickets", payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extranet", "intervenant", "tickets"] });
    },
  });
}

/** Fil de discussion d'un ticket côté extranet intervenant. */
export function useIntervenantTicketMessages(ticketId: number | null) {
  return useQuery({
    queryKey: ["extranet", "intervenant", "tickets", ticketId, "messages"],
    enabled: !!ticketId,
    queryFn: async () =>
      (await api.get(`/extranet/intervenant/tickets/${ticketId}/messages`)).data.data,
  });
}

export function usePostIntervenantTicketMessage(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      (await api.post(`/extranet/intervenant/tickets/${ticketId}/messages`, { body })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extranet", "intervenant", "tickets", ticketId, "messages"] });
    },
  });
}
