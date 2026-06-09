import { create } from "zustand";
import { api, csrf } from "@/lib/api";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  must_change_password: boolean;
  role: string | null;
  permissions: string[];
  last_login_at: string | null;
  /** URL absolue de l'avatar personnel (null si non uploadé). */
  avatar_url: string | null;
};

type AuthState = {
  user: AuthUser | null;
  status: "idle" | "loading" | "ready";
  fetchMe: () => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  hasRole: (role: string) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "idle",

  fetchMe: async () => {
    set({ status: "loading" });
    try {
      const { data } = await api.get<{ data: AuthUser }>("/me");
      set({ user: data.data, status: "ready" });
    } catch {
      set({ user: null, status: "ready" });
    }
  },

  login: async (email, password, remember = false) => {
    await csrf();
    const { data } = await api.post<{ data: AuthUser }>("/login", { email, password, remember });
    set({ user: data.data, status: "ready" });
  },

  logout: async () => {
    try {
      await api.post("/logout");
    } finally {
      set({ user: null, status: "ready" });
    }
  },

  hasPermission: (perm) => {
    const user = get().user;
    return !!user && user.permissions.includes(perm);
  },

  hasRole: (role) => {
    const user = get().user;
    return !!user && user.role === role;
  },
}));
