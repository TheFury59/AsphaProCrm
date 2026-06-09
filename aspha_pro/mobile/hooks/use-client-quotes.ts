// Hooks devis cote client mobile.
//
// Endpoints :
//   GET    /extranet/client/quotes                 — liste (sans draft)
//   POST   /extranet/client/quotes/{id}/accept     — valider un devis sent
//   POST   /extranet/client/quotes/{id}/refuse     — refuser un devis sent
//   GET    /extranet/client/quotes/{id}/pdf        — download PDF stream
//
// Convention cache-key : ["client-quotes"]

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ApiResponse, Quote, QuoteStatus } from "@/types/api";

export function useClientQuotes(): UseQueryResult<Quote[], Error> {
  return useQuery<Quote[], Error>({
    queryKey: ["client-quotes"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Quote[]>>(
        "/extranet/client/quotes",
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useAcceptClientQuote(): UseMutationResult<Quote, Error, number> {
  const qc = useQueryClient();
  return useMutation<Quote, Error, number>({
    mutationFn: async (quoteId) => {
      const { data } = await api.post<ApiResponse<Quote>>(
        `/extranet/client/quotes/${quoteId}/accept`,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-quotes"] });
    },
  });
}

export function useRefuseClientQuote(): UseMutationResult<Quote, Error, number> {
  const qc = useQueryClient();
  return useMutation<Quote, Error, number>({
    mutationFn: async (quoteId) => {
      const { data } = await api.post<ApiResponse<Quote>>(
        `/extranet/client/quotes/${quoteId}/refuse`,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-quotes"] });
    },
  });
}

// === Helpers UI ===
export function quoteStatusLabel(s: QuoteStatus): string {
  switch (s) {
    case "draft":
      return "Brouillon";
    case "sent":
      return "À valider";
    case "accepted":
      return "Validé";
    case "refused":
      return "Refusé";
    default:
      return s;
  }
}

export function quoteStatusColor(s: QuoteStatus): string {
  switch (s) {
    case "draft":
      return "#6b7280";
    case "sent":
      return "#f59e0b"; // amber
    case "accepted":
      return "#16a34a"; // green
    case "refused":
      return "#dc2626"; // red
    default:
      return "#6b7280";
  }
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
