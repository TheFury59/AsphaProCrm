// Client HTTP pour l'app mobile.
// Differences vs web :
//   - Pas de cookies / CSRF : on est en cross-origin natif, on utilise Bearer.
//   - Le token vit dans le store Zustand (hydrate depuis secure-store au boot).
//   - 401 -> on vide le store + secure-store ; le root layout redirige vers /login.

import axios, { AxiosError, AxiosInstance } from "axios";
import Constants from "expo-constants";

import type { ApiErrorBody } from "@/types/api";

function resolveBaseUrl(): string {
  // Priorite : EXPO_PUBLIC_API_URL (env) > expo.extra.apiUrl (app.json) > fallback prod.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl) return extra.apiUrl;

  return "https://asphapro-erp.fr/api/v1";
}

export const API_BASE_URL = resolveBaseUrl();

// On utilise un getter de token + un hook de logout passes par setAuthBridge
// pour eviter la dependance circulaire (lib/api.ts <-> stores/auth.ts).
type AuthBridge = {
  getToken: () => string | null;
  onUnauthorized: () => void;
};

let bridge: AuthBridge = {
  getToken: () => null,
  onUnauthorized: () => {},
};

export function setAuthBridge(next: AuthBridge): void {
  bridge = next;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = bridge.getToken();
  if (token && config.headers) {
    // config.headers est toujours present (axios 1.x : AxiosHeaders), on l'utilise directement.
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401) {
      // Token invalide / expire — on notifie le store qui clear + redirige.
      bridge.onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export function isApiError(e: unknown): e is AxiosError<ApiErrorBody> {
  return e instanceof AxiosError;
}

export function apiErrorMessage(e: unknown, fallback = "Erreur inattendue"): string {
  if (!isApiError(e)) return fallback;
  const data = e.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first.length > 0 && typeof first[0] === "string") {
      return first[0];
    }
  }
  return data?.message ?? e.message ?? fallback;
}
