import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore, type AuthUser } from "@/stores/auth";

/**
 * Hooks user/admin :
 *  - useUpdateMe : édition profil utilisateur connecté
 *  - useAdminUsers : liste users (super_admin only)
 *  - useAvailableRoles : référentiel des 4 rôles
 *  - useSetUserRole / useUpdateUserStatus : mutations super_admin
 */

// =========================================================================
// MOI (utilisateur connecté)
// =========================================================================

export type UpdateMePayload = {
  name?: string;
  email?: string;
  password?: string;
  current_password?: string;
};

export function useUpdateMe() {
  // Le store d'auth doit être re-synced après update pour que la topbar
  // affiche le nouveau nom/email immédiatement.
  const fetchMe = useAuthStore((s) => s.fetchMe);
  return useMutation({
    mutationFn: async (payload: UpdateMePayload) => {
      const { data } = await api.patch<{ data: AuthUser }>("/me", payload);
      return data.data;
    },
    onSuccess: () => fetchMe(),
  });
}

// =========================================================================
// ADMIN — gestion users (super_admin only)
// =========================================================================

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  role: "super_admin" | "admin" | "intervenant" | "client" | null;
  // URL absolue de la photo de profil (accessor User::avatar_url côté Laravel,
  // construit avec `?v=updated_at` pour le cache-bust). null si pas d'avatar.
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string | null;
};

export type RoleInfo = {
  name: "super_admin" | "admin" | "intervenant" | "client";
  label: string;
  description: string;
};

export function useAdminUsers(params: { search?: string; role?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.search) qs.set("search", params.search);
      if (params.role) qs.set("role", params.role);
      if (params.page) qs.set("page", String(params.page));
      const { data } = await api.get<{ data: { data: AdminUser[]; total: number; current_page: number; last_page: number } }>(
        `/admin/users?${qs}`,
      );
      // Backend renvoie ['data' => $paginate] : on dé-wrap
      const p: any = (data as any).data ?? data;
      return {
        users: (p.data ?? []) as AdminUser[],
        meta: {
          total: p.total ?? 0,
          current_page: p.current_page ?? 1,
          last_page: p.last_page ?? 1,
        },
      };
    },
  });
}

export function useAvailableRoles() {
  return useQuery({
    queryKey: ["admin", "users", "roles"],
    queryFn: async () => (await api.get<{ data: RoleInfo[] }>("/admin/users/roles")).data.data,
    staleTime: 5 * 60_000,  // référentiel quasi-statique
  });
}

export type CreateUserPayload = {
  name: string;
  email: string;
  password?: string;
  role: "super_admin" | "admin" | "intervenant" | "client";
};

export type CreateUserResult = {
  user: { id: number; name: string; email: string; role: string };
  password: string;
  password_was_generated: boolean;
};

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await api.post<{ data: CreateUserResult }>("/admin/users", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const { data } = await api.post<{ data: { id: number; role: string } }>(
        `/admin/users/${userId}/role`,
        { role },
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: "active" | "inactive" }) => {
      const { data } = await api.patch(`/admin/users/${userId}`, { status });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

/**
 * Suppression COMPLÈTE d'un user (hard-delete + cascade BDD).
 *
 * - super_admin uniquement (vérifié serveur).
 * - On ne peut pas supprimer son propre compte (409).
 * - On ne peut pas supprimer le dernier super_admin (409).
 * - Si l'user est lié à un Employee avec interventions futures, refus avec
 *   message clair. L'option `force=true` bypasse pour les super_admin.
 */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, force }: { userId: number; force?: boolean }) => {
      const query = force ? "?force=1" : "";
      await api.delete(`/admin/users/${userId}${query}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
