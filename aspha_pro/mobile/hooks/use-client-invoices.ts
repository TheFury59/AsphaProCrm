// Hooks factures cote client mobile.
//
// Endpoints :
//   GET    /extranet/client/invoices    — liste (sans draft)
//
// Convention cache-key : ["client-invoices"]
//
// Le PDF facture client n'a pas (encore) son endpoint dedie cote backend ;
// quand il sera la on ajoutera `useDownloadInvoicePdf` ici sur le meme modele
// que `downloadQuotePdf`. Pour V1 du sprint P1-3, c'est juste de la consultation.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ApiResponse, Invoice } from "@/types/api";

export function useClientInvoices(): UseQueryResult<Invoice[], Error> {
  return useQuery<Invoice[], Error>({
    queryKey: ["client-invoices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Invoice[]>>(
        "/extranet/client/invoices",
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

// === Helpers UI ===
// On normalise sur payment_status quand present, sinon on retombe sur status.
// Cote backend Invoice : `status` = workflow (draft/sent/...), `payment_status`
// = paid/partial/unpaid/overdue (peut etre null pour les vieilles factures).
export function invoicePaymentLabel(inv: Invoice): string {
  const ps = (inv.payment_status ?? "").toLowerCase();
  if (ps === "paid") return "Payée";
  if (ps === "partial") return "Partielle";
  if (ps === "unpaid") return "Impayée";
  if (ps === "overdue") return "En retard";
  if (ps === "pending") return "En attente";
  // Fallback sur status si payment_status est null
  const st = (inv.status ?? "").toLowerCase();
  if (st === "paid") return "Payée";
  if (st === "overdue") return "En retard";
  if (st === "cancelled") return "Annulée";
  return inv.status ?? "—";
}

export function invoicePaymentColor(inv: Invoice): string {
  const ps = (inv.payment_status ?? inv.status ?? "").toLowerCase();
  if (ps === "paid") return "#16a34a";
  if (ps === "partial") return "#f59e0b";
  if (ps === "overdue") return "#dc2626";
  if (ps === "cancelled") return "#6b7280";
  // unpaid / pending / sent / autres : neutre informationnel
  return "#3b82f6";
}

export function isInvoiceUnpaid(inv: Invoice): boolean {
  const ps = (inv.payment_status ?? "").toLowerCase();
  if (ps === "paid") return false;
  if (ps === "unpaid" || ps === "partial" || ps === "overdue" || ps === "pending") return true;
  // Si pas de payment_status, on prend status != paid/cancelled comme « impayee »
  const st = (inv.status ?? "").toLowerCase();
  return st !== "paid" && st !== "cancelled" && st !== "draft";
}
