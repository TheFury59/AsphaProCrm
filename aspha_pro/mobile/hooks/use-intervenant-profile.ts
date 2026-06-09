// Hooks profil intervenant côté mobile.
//
// Endpoints :
//   GET    /extranet/intervenant/profile  — fiche complète (employee + user)
//   POST   /extranet/intervenant/avatar   — upload photo (multipart/form-data)
//   DELETE /extranet/intervenant/avatar   — supprimer la photo
//
// Convention cache-key : ["intervenant-profile"]

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse } from "@/types/api";

export type IntervenantProfile = {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  user: { id: number; email: string } | null;
  entity: { id: number; label: string } | null;
};

export function useIntervenantProfile(): UseQueryResult<IntervenantProfile, Error> {
  return useQuery<IntervenantProfile, Error>({
    queryKey: ["intervenant-profile"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<IntervenantProfile>>(
        "/extranet/intervenant/profile",
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useUploadIntervenantAvatar(): UseMutationResult<
  IntervenantProfile,
  Error,
  { uri: string; name: string; mimeType: string }
> {
  const qc = useQueryClient();
  return useMutation<IntervenantProfile, Error, { uri: string; name: string; mimeType: string }>({
    mutationFn: async ({ uri, name, mimeType }) => {
      // React Native FormData : on passe directement l'objet { uri, name, type }
      // que axios sérialise en multipart côté natif.
      const formData = new FormData();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formData.append("avatar", { uri, name, type: mimeType } as any);

      // Upload sur /me/avatar (users.avatar_path) — partagé avec frontend web.
      // L'ancien /extranet/intervenant/avatar (employees.avatar_path) reste
      // disponible pour rétrocompat mais n'est plus utilisé.
      await api.post(
        "/me/avatar",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      // Refetch le profil pour récupérer la nouvelle avatar_url côté employee
      // (l'accessor User::avatar_url est exposé via /me, on l'invalide aussi).
      const { data } = await api.get<ApiResponse<IntervenantProfile>>(
        "/extranet/intervenant/profile",
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intervenant-profile"] });
      // Refetch /me dans le store auth pour rafraichir user.avatar_url
      // (utilisé partout pour afficher l'avatar du user connecté).
      void useAuthStore.getState().refetchMe();
    },
  });
}

export function useDeleteIntervenantAvatar(): UseMutationResult<void, Error, void> {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.delete("/me/avatar");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intervenant-profile"] });
      void useAuthStore.getState().refetchMe();
    },
  });
}

/**
 * Initiales (2 lettres max) à afficher dans le fallback avatar quand
 * l'intervenant n'a pas encore mis sa photo.
 */
export function getInitials(profile?: IntervenantProfile | null, fallback?: string): string {
  if (!profile) {
    return (fallback ?? "?").slice(0, 2).toUpperCase();
  }
  const first = (profile.first_name ?? "").charAt(0);
  const last = (profile.last_name ?? "").charAt(0);
  const combined = `${first}${last}`.trim();
  if (combined) return combined.toUpperCase();
  return (fallback ?? profile.email ?? "?").slice(0, 2).toUpperCase();
}
