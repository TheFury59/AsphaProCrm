// Hook React Query : planning intervenant.
// Endpoint : GET /extranet/intervenant/planning?from=YYYY-MM-DD&to=YYYY-MM-DD
// Sans champ `price` (le backend strip cote intervenant — F1).
//
// Convention de cache-key : ["intervenant-planning", "YYYY-MM-DD", "YYYY-MM-DD"]
// => les deux ecrans (liste + detail) partagent EXACTEMENT la meme query, donc
// le detail lit le cache sans re-fetch.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { addDays, startOfToday, toDateKey } from "@/lib/date";
import type { ApiResponse } from "@/types/api";

export type IntervenantEventStatus =
  | "a_pourvoir"
  | "planifiee"
  | "realisee"
  | "annulee"
  | "draft"
  | "terminated";

export type IntervenantClientAddress = {
  id: number;
  address: string;
  postal_code: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type IntervenantClient = {
  id: number;
  code: string;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  intervenant_notes?: string | null;
  address: IntervenantClientAddress | null;
};

export type IntervenantEmployee = {
  id: number;
  name: string;
};

export type IntervenantPrestation = {
  id: number;
  label: string;
  product_name?: string | null;
};

export type IntervenantCheckin = {
  checkin_time?: string | null;
  checkout_time?: string | null;
};

// Shape minimale exposee par /extranet/intervenant/planning.
// Pas de champ `price` cote intervenant (strip backend F1).
export type IntervenantEvent = {
  id: string | number;
  intervention_id: number;
  start_datetime: string; // « YYYY-MM-DDTHH:mm:ss » local naif
  end_datetime: string;
  status: IntervenantEventStatus;
  client: IntervenantClient;
  employee: IntervenantEmployee;
  prestation: IntervenantPrestation | null;
  checkin: IntervenantCheckin | null;
  internal_comment: string | null;
  comment: string | null;
  keys_count: number;
  has_keys: boolean;
};

export type IntervenantPlanningRange = {
  from: Date;
  to: Date;
};

function defaultRange(): IntervenantPlanningRange {
  const from = startOfToday();
  const to = addDays(from, 7);
  return { from, to };
}

// Pour normaliser l'id en string (le backend peut renvoyer un number simple ou
// une string « 42-20260615 » pour les occurrences recurrentes).
export function eventIdToString(id: string | number): string {
  return String(id);
}

export function buildPlanningQueryKey(from: Date, to: Date): readonly [
  "intervenant-planning",
  string,
  string,
] {
  return ["intervenant-planning", toDateKey(from), toDateKey(to)] as const;
}

export function useIntervenantPlanning(
  from?: Date,
  to?: Date,
): UseQueryResult<IntervenantEvent[], Error> {
  const range: IntervenantPlanningRange = from && to ? { from, to } : defaultRange();
  const fromKey = toDateKey(range.from);
  const toKey = toDateKey(range.to);

  return useQuery<IntervenantEvent[], Error>({
    queryKey: buildPlanningQueryKey(range.from, range.to),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<IntervenantEvent[]>>(
        "/extranet/intervenant/planning",
        { params: { from: fromKey, to: toKey } },
      );
      return data.data;
    },
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}
