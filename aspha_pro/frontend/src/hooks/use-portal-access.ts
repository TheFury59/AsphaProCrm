import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Hooks pour gérer l'accès extranet d'une entité (client ou employee).
 *
 * Le mot de passe en clair n'est retourné que dans la réponse API
 * (une seule fois). L'UI doit le proposer à la copie immédiatement
 * après — pas de re-fetch possible côté serveur.
 *
 * Le type `EntityType` permet de partager le même hook entre les 2 cas
 * (client → `clients/{id}/portal-access`, employee → `employees/{id}/portal-access`).
 */

export type EntityType = "client" | "employee";

export type PortalAccessResult = {
  user: { id: number; name: string; email: string; status: string };
  password: string;
  email_sent: boolean;
  note?: string;
};

function basePath(type: EntityType, id: number): string {
  return type === "client"
    ? `/clients/${id}/portal-access`
    : `/employees/${id}/portal-access`;
}

function invalidateEntity(qc: ReturnType<typeof useQueryClient>, type: EntityType, id: number) {
  if (type === "client") {
    qc.invalidateQueries({ queryKey: ["clients", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  } else {
    qc.invalidateQueries({ queryKey: ["employees", id] });
    qc.invalidateQueries({ queryKey: ["employees"] });
  }
}

/**
 * Crée l'accès extranet pour un client OU un intervenant.
 * - Client : User créé avec rôle "client", lié via clients.portal_user_id
 * - Employee : User créé avec rôle "intervenant", lié via employees.user_id
 *
 * `email` est obligatoire pour intervenant (pas de email auto-fill), optionnel
 * pour client (fallback sur company.primary_email côté backend).
 */
export function useCreatePortalAccess(type: EntityType, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { email?: string; send_email?: boolean }) => {
      const { data } = await api.post<{ data: PortalAccessResult }>(
        basePath(type, id),
        params,
      );
      return data.data;
    },
    onSuccess: () => invalidateEntity(qc, type, id),
  });
}

export function useResetPortalAccess(type: EntityType, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { send_email?: boolean } = {}) => {
      const { data } = await api.post<{ data: PortalAccessResult }>(
        `${basePath(type, id)}/reset`,
        params,
      );
      return data.data;
    },
    onSuccess: () => invalidateEntity(qc, type, id),
  });
}

export function useSendPortalEmail(type: EntityType, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: PortalAccessResult }>(
        `${basePath(type, id)}/email`,
      );
      return data.data;
    },
    onSuccess: () => invalidateEntity(qc, type, id),
  });
}

export function useRevokePortalAccess(type: EntityType, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(basePath(type, id));
    },
    onSuccess: () => invalidateEntity(qc, type, id),
  });
}
