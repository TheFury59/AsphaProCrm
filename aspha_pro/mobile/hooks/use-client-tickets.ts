// Hooks tickets / demandes cote client mobile.
//
// Endpoints :
//   GET    /extranet/client/tickets               — liste (du client connecte)
//   POST   /extranet/client/tickets               — create
//   GET    /extranet/client/tickets/{id}/messages — fil de discussion
//   POST   /extranet/client/tickets/{id}/messages — repondre
//
// Convention de cache-keys :
//   ["client-tickets"]                  — liste
//   ["client-ticket-messages", id]      — fil d'un ticket
//
// Le fil de messages est rafraichi toutes les 5 s tant que l'ecran est monte
// (effet « live » sans WebSocket, idem cote intervenant).

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
  CreateClientTicketRequest,
  Ticket,
  TicketMessage,
} from "@/types/api";

// === LISTE ===
export function useClientTickets(): UseQueryResult<Ticket[], Error> {
  return useQuery<Ticket[], Error>({
    queryKey: ["client-tickets"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Ticket[]>>(
        "/extranet/client/tickets",
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

// === MESSAGES ===
export function useClientTicketMessages(
  ticketId: number | null,
): UseQueryResult<TicketMessage[], Error> {
  return useQuery<TicketMessage[], Error>({
    queryKey: ["client-ticket-messages", ticketId],
    enabled: ticketId != null,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TicketMessage[]>>(
        `/extranet/client/tickets/${ticketId}/messages`,
      );
      return data.data;
    },
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

// === CREATE TICKET ===
export function useCreateClientTicket(): UseMutationResult<
  Ticket,
  Error,
  CreateClientTicketRequest
> {
  const qc = useQueryClient();
  return useMutation<Ticket, Error, CreateClientTicketRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiResponse<Ticket>>(
        "/extranet/client/tickets",
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-tickets"] });
    },
  });
}

// === SEND MESSAGE ===
export function useSendClientTicketMessage(
  ticketId: number,
): UseMutationResult<TicketMessage, Error, { body: string }> {
  const qc = useQueryClient();
  return useMutation<TicketMessage, Error, { body: string }>({
    mutationFn: async ({ body }) => {
      const { data } = await api.post<ApiResponse<TicketMessage>>(
        `/extranet/client/tickets/${ticketId}/messages`,
        { body },
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-ticket-messages", ticketId] });
      void qc.invalidateQueries({ queryKey: ["client-tickets"] });
    },
  });
}
