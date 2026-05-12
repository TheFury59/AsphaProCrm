import { create } from "zustand";
import { api, csrf } from "@/lib/api";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  type: "admin" | "manager" | "employee" | "client";
  site_id: number | null;
  roles: string[];
  last_login_at: string | null;
};

type AuthState = {
  user: AuthUser | null;
  status: "idle" | "loading" | "ready";
  fetchMe: () => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  fetchMe: async () => {
    set({ status: "loading" });
    try {
      const { data } = await api.get<AuthUser>("/me");
      set({ user: data, status: "ready" });
    } catch {
      set({ user: null, status: "ready" });
    }
  },

  login: async (email, password, remember = false) => {
    await csrf();
    const { data } = await api.post<AuthUser>("/login", { email, password, remember });
    set({ user: data, status: "ready" });
  },

  logout: async () => {
    try {
      await api.post("/logout");
    } finally {
      set({ user: null, status: "ready" });
    }
  },
}));
