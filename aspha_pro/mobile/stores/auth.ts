// Store Zustand : token + user + cycle de vie auth.
// Difference vs web : on persiste le token dans expo-secure-store (Keychain/Keystore)
// et on injecte les hooks bridge vers axios (setAuthBridge).

import { create } from "zustand";

import { api, apiErrorMessage, setAuthBridge } from "@/lib/api";
import { clearToken, getToken, saveToken } from "@/lib/secure-store";
import type { ApiResponse, AuthUser, MobileLoginResponse } from "@/types/api";

type AuthStatus = "idle" | "hydrating" | "authenticated" | "anonymous";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;

  hydrate: () => Promise<void>;
  login: (email: string, password: string, deviceName: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  refetchMe: () => Promise<void>;

  hasPermission: (perm: string) => boolean;
  hasRole: (role: AuthUser["role"]) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  status: "idle",

  hydrate: async () => {
    set({ status: "hydrating" });
    try {
      const stored = await getToken();
      if (!stored) {
        set({ token: null, user: null, status: "anonymous" });
        return;
      }
      // On pose le token AVANT l'appel /me pour que l'interceptor l'injecte.
      set({ token: stored });
      const { data } = await api.get<ApiResponse<AuthUser>>("/me");
      set({ user: data.data, status: "authenticated" });
    } catch (err) {
      console.error("[auth] hydrate failed", err);
      // Token invalide / probleme reseau persistant -> on vide.
      await clearToken();
      set({ token: null, user: null, status: "anonymous" });
    }
  },

  login: async (email, password, deviceName) => {
    // Pas de disabled UI sur le bouton -> on revalide ici cote logique.
    if (!email.trim() || !password) {
      throw new Error("Email et mot de passe requis");
    }

    try {
      const { data } = await api.post<MobileLoginResponse>("/mobile/login", {
        email: email.trim(),
        password,
        device_name: deviceName,
      });
      const { token, user } = data.data;
      await saveToken(token);
      set({ token, user, status: "authenticated" });
    } catch (err) {
      console.error("[auth] login failed", err);
      // Rethrow pour que l'ecran affiche le toast.
      throw new Error(apiErrorMessage(err, "Identifiants invalides"));
    }
  },

  logout: async () => {
    const currentToken = get().token;
    try {
      if (currentToken) {
        await api.post("/mobile/logout");
      }
    } catch (err) {
      // On ignore l'erreur reseau : on doit pouvoir se deconnecter offline.
      console.error("[auth] logout API call failed (ignored)", err);
    } finally {
      try {
        await clearToken();
      } catch (err) {
        console.error("[auth] clearToken failed", err);
      }
      set({ token: null, user: null, status: "anonymous" });
    }
  },

  setUser: (user) => {
    set({ user });
  },

  refetchMe: async () => {
    try {
      const { data } = await api.get<ApiResponse<AuthUser>>("/me");
      set({ user: data.data });
    } catch (err) {
      console.error("[auth] refetchMe failed", err);
      throw err;
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

// === Bridge axios <-> store (evite la dependance circulaire). ===
// Doit etre appele une fois cote app (root layout l'invoque au mount).
export function bindAuthBridge(): void {
  setAuthBridge({
    getToken: () => useAuthStore.getState().token,
    onUnauthorized: () => {
      // 401 -> on clear immediatement. Le root layout redirige sur status anonymous.
      void (async () => {
        try {
          await clearToken();
        } catch (err) {
          console.error("[auth] clearToken on 401 failed", err);
        }
        useAuthStore.setState({ token: null, user: null, status: "anonymous" });
      })();
    },
  });
}
