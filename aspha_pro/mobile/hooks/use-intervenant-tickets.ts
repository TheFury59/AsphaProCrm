// Hooks React Query : tickets (signalements) cote intervenant.
//
// Endpoints :
//   GET    /extranet/intervenant/tickets               — liste
//   POST   /extranet/intervenant/tickets               — create
//   GET    /extranet/intervenant/tickets/{id}/messages — fil de discussion
//   POST   /extranet/intervenant/tickets/{id}/messages — repondre
//   GET    /extranet/intervenant/my-clients            — clients pour picker
//
// Convention de cache-keys :
//   ["intervenant-tickets"]          — liste
//   ["ticket-messages", ticketId]    — fil d'un ticket
//   ["intervenant-my-clients"]       — clients eligibles a un signalement
//
// Le fil de messages est rafraichi toutes les 15 s tant que l'ecran est
// monte (pour un effet « live » sans WebSocket).

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  ApiResponse,
  CreateTicketRequest,
  MyClient,
  Ticket,
  TicketMessage,
} from "@/types/api";

// === LISTE ===
export function useIntervenantTickets(): UseQueryResult<Ticket[], Error> {
  return useQuery<Ticket[], Error>({
    queryKey: ["intervenant-tickets"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Ticket[]>>(
        "/extranet/intervenant/tickets",
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

// === MESSAGES ===
export function useTicketMessages(
  ticketId: number | null,
): UseQueryResult<TicketMessage[], Error> {
  return useQuery<TicketMessage[], Error>({
    queryKey: ["ticket-messages", ticketId],
    enabled: ticketId != null,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TicketMessage[]>>(
        `/extranet/intervenant/tickets/${ticketId}/messages`,
      );
      return data.data;
    },
    staleTime: 2_000,
    // Poll aggressive (5 s) tant que l'ecran est ouvert pour effet « live »
    // proche du chat instantane sans WebSocket. La query est unmount des que
    // l'user quitte l'ecran detail (FlatList demonte) → pas de cout reseau
    // en arriere-plan.
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

// === CREATE TICKET ===
export function useCreateTicket(): UseMutationResult<
  Ticket,
  Error,
  CreateTicketRequest
> {
  const qc = useQueryClient();
  return useMutation<Ticket, Error, CreateTicketRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiResponse<Ticket>>(
        "/extranet/intervenant/tickets",
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intervenant-tickets"] });
    },
  });
}

// === SEND MESSAGE ===
export function useSendTicketMessage(
  ticketId: number,
): UseMutationResult<TicketMessage, Error, { body: string }> {
  const qc = useQueryClient();
  return useMutation<TicketMessage, Error, { body: string }>({
    mutationFn: async ({ body }) => {
      const { data } = await api.post<ApiResponse<TicketMessage>>(
        `/extranet/intervenant/tickets/${ticketId}/messages`,
        { body },
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
      void qc.invalidateQueries({ queryKey: ["intervenant-tickets"] });
    },
  });
}

// === MY CLIENTS (pour picker dans le formulaire create) ===
export function useIntervenantMyClients(): UseQueryResult<MyClient[], Error> {
  return useQuery<MyClient[], Error>({
    queryKey: ["intervenant-my-clients"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MyClient[]>>(
        "/extranet/intervenant/my-clients",
      );
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
}

// === Helpers UI ===
export function ticketTypeLabel(t: Ticket["type"]): string {
  switch (t) {
    case "complaint":
      return "Réclamation";
    case "problem_report":
      return "Signalement";
    case "consumable_reorder":
      return "Réassort";
  }
}

export function ticketStatusLabel(s: Ticket["status"]): string {
  switch (s) {
    case "open":
      return "Ouvert";
    case "in_progress":
      return "En cours";
    case "resolved":
      return "Résolu";
    case "closed":
      return "Fermé";
  }
}

export function ticketStatusColor(s: Ticket["status"]): string {
  switch (s) {
    case "open":
      return "#3b82f6"; // blue
    case "in_progress":
      return "#f59e0b"; // amber
    case "resolved":
      return "#22c55e"; // green
    case "closed":
      return "#6b7280"; // gray
  }
}

export function ticketPriorityLabel(p: Ticket["priority"]): string {
  switch (p) {
    case "low":
      return "Faible";
    case "normal":
      return "Normale";
    case "high":
      return "Haute";
    case "urgent":
      return "Urgente";
  }
}

export function ticketPriorityColor(p: Ticket["priority"]): string {
  switch (p) {
    case "low":
      return "#6b7280";
    case "normal":
      return "#3b82f6";
    case "high":
      return "#f59e0b";
    case "urgent":
      return "#dc2626";
  }
}

export function clientDisplayName(c?: TicketClientShape | null): string {
  if (!c) return "Client inconnu";
  return c.company?.company_name ?? c.code ?? "Client";
}

type TicketClientShape = {
  code?: string;
  company?: { company_name: string } | null;
};
