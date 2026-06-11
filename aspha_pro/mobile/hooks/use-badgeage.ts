// Hook React Query : badgeage QR (arrivée / départ).
// Endpoint : POST /telemanagement/badge
//
// Le backend dérive `employee_id` depuis le user authentifié quand absent
// du payload (cf. TelemanagementController::badge, modif sprint P0-3).
// On NE transmet donc pas employee_id côté mobile : le serveur fait foi.
//
// Sur succès, on invalide la query `["intervenant-planning", ...]` pour que
// le planning se rafraîchisse (le RDV doit basculer en « réalisé »).

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/api";

export type BadgeEventType = "arrival" | "departure";

export type BadgePayload = {
  qr_code: string;
  event_type: BadgeEventType;
  intervention_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

// Shape de la réponse — voir TelemanagementController::badge.
export type BadgeCheckin = {
  id: number;
  employee_id: number;
  intervention_id: number | null;
  qr_code_id: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  latitude: number | null;
  longitude: number | null;
  flag_no_gps: boolean;
};

export type BadgeResponseData = {
  checkin: BadgeCheckin;
  intervention_id: number | null;
  qr_code: string;
};

export function useBadgeage(): UseMutationResult<BadgeResponseData, Error, BadgePayload> {
  const queryClient = useQueryClient();

  return useMutation<BadgeResponseData, Error, BadgePayload>({
    mutationFn: async (payload) => {
      // On n'envoie pas les champs nuls/undefined (le validator Laravel
      // les accepte mais autant rester clean) sauf event_type/qr_code.
      const body: Record<string, unknown> = {
        qr_code: payload.qr_code,
        event_type: payload.event_type,
      };
      if (payload.intervention_id != null) {
        body.intervention_id = payload.intervention_id;
      }
      if (payload.latitude != null && payload.longitude != null) {
        body.latitude = payload.latitude;
        body.longitude = payload.longitude;
      }

      const { data } = await api.post<ApiResponse<BadgeResponseData>>(
        "/telemanagement/badge",
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      // Le RDV vient potentiellement de passer en « realisee » → on force
      // un refetch immediat de TOUS les caches planning (cf. lessons.md
      // 2026-05-18 : refetchType active ne refresh que les caches affichés
      // à ce moment-là, donc quand l'utilisateur revient sur le détail RDV
      // après le badge, il lit un cache stale et voit « pas encore badgé »
      // alors que la BDD a déjà le checkin). « all » force toutes les
      // ranges actives + inactives à se rafraîchir.
      void queryClient.invalidateQueries({
        queryKey: ["intervenant-planning"],
        refetchType: "all",
      });
    },
  });
}
