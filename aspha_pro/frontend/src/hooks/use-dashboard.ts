import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * KPI agrégés du tableau de bord — tous calculés en BDD côté backend
 * (`GET /dashboard/stats`, réservé aux admins). Remplace les anciens
 * appels front bricolés (`useClients({per_page:1})` lus pour `meta.total`).
 */
export type DashboardStats = {
  clients_active: number;
  employees_count: number;
  interventions_upcoming_30d: number;
  interventions_to_fill: number;
  unpaid_invoices_count: number;
  unpaid_invoices_total: number;
  pending_quotes_count: number;
  revenue_this_month: number;
  revenue_prev_month: number;
  /** Variation CA vs mois précédent, en %. `null` si pas de base fiable. */
  revenue_trend_pct: number | null;
};

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const { data } = await api.get<{ data: DashboardStats }>("/dashboard/stats");
      return data.data;
    },
    staleTime: 60_000, // 1 min
  });
}
