import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Hooks pour gérer l'accès extranet d'un client.
 *
 * Le mot de passe en clair n'est retourné que dans la réponse API
 * (une seule fois). L'UI doit le proposer à la copie immédiatement
 * après — pas de re-fetch possible côté serveur.
 */

export type PortalAccessResult = {
  user: { id: number; name: string; email: string; status: string };
  password: string;
  email_sent: boolean;
  note?: string;
};

function invalidateClient(qc: ReturnType<typeof useQueryClient>, clientId: number) {
  qc.invalidateQueries({ queryKey: ["clients", clientId] });
  qc.invalidateQueries({ queryKey: ["clients"] });
}

/**
 * Crée l'accès extranet (User dédié + rôle "client" + lien portal_user_id).
 * `email` est optionnel : si omis, on utilise client.company.primary_email.
 */
export function useCreatePortalAccess(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { email?: string; send_email?: boolean }) => {
      const { data } = await api.post<{ data: PortalAccessResult }>(
        `/clients/${clientId}/portal-access`,
        params,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useResetPortalAccess(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { send_email?: boolean } = {}) => {
      const { data } = await api.post<{ data: PortalAccessResult }>(
        `/clients/${clientId}/portal-access/reset`,
        params,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useSendPortalEmail(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: PortalAccessResult }>(
        `/clients/${clientId}/portal-access/email`,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useRevokePortalAccess(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/clients/${clientId}/portal-access`);
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}
