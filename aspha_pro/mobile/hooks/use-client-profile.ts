// Hooks profil client cote mobile.
//
// Endpoints :
//   GET    /extranet/client/profile   — Client + company + addresses + contacts
//   POST   /extranet/client/logo      — upload logo entreprise (multipart 'logo')
//   DELETE /extranet/client/logo      — supprimer le logo
//
// Convention cache-key : ["client-profile"]

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ApiResponse, ClientCompanyShape, ClientProfile } from "@/types/api";

export function useClientProfile(): UseQueryResult<ClientProfile, Error> {
  return useQuery<ClientProfile, Error>({
    queryKey: ["client-profile"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ClientProfile>>(
        "/extranet/client/profile",
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useUploadClientLogo(): UseMutationResult<
  ClientCompanyShape,
  Error,
  { uri: string; name: string; mimeType: string }
> {
  const qc = useQueryClient();
  return useMutation<ClientCompanyShape, Error, { uri: string; name: string; mimeType: string }>({
    mutationFn: async ({ uri, name, mimeType }) => {
      const formData = new FormData();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formData.append("logo", { uri, name, type: mimeType } as any);
      const { data } = await api.post<ApiResponse<ClientCompanyShape>>(
        "/extranet/client/logo",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
  });
}

export function useDeleteClientLogo(): UseMutationResult<void, Error, void> {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.delete("/extranet/client/logo");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
  });
}

/**
 * Initiales pour fallback logo entreprise quand pas de photo.
 * 2 lettres max — prend les 2 premieres consonnes/voyelles du nom.
 */
export function getCompanyInitials(profile?: ClientProfile | null, fallback?: string): string {
  const name = profile?.company?.company_name ?? fallback ?? "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
