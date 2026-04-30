import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

export async function csrf() {
  await axios.get("/sanctum/csrf-cookie", { withCredentials: true });
}

export function isApiError(e: unknown): e is AxiosError<{ message?: string; errors?: Record<string, string[]> }> {
  return e instanceof AxiosError;
}

export function apiErrorMessage(e: unknown, fallback = "Erreur inattendue"): string {
  if (!isApiError(e)) return fallback;
  const data = e.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first.length > 0) return first[0];
  }
  return data?.message ?? e.message ?? fallback;
}
