import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useIntervenantProfile() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "profile"],
    queryFn: async () => (await api.get("/extranet/intervenant/profile")).data.data,
  });
}

export function useIntervenantPlanning(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ["extranet", "intervenant", "planning", params],
    queryFn: async () => (await api.get("/extranet/intervenant/planning", { params })).data.data,
    staleTime: 30_000,
  });
}

export function useIntervenantAbsences() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "absences"],
    queryFn: async () => (await api.get("/extranet/intervenant/absences")).data.data,
  });
}

export function useIntervenantContract() {
  return useQuery({
    queryKey: ["extranet", "intervenant", "contract"],
    queryFn: async () => (await api.get("/extranet/intervenant/contract")).data.data,
  });
}

// === Client extranet ===

export function useClientProfile() {
  return useQuery({
    queryKey: ["extranet", "client", "profile"],
    queryFn: async () => (await api.get("/extranet/client/profile")).data.data,
  });
}

export function useClientInvoices() {
  return useQuery({
    queryKey: ["extranet", "client", "invoices"],
    queryFn: async () => (await api.get("/extranet/client/invoices")).data.data,
  });
}

export function useClientQuotes() {
  return useQuery({
    queryKey: ["extranet", "client", "quotes"],
    queryFn: async () => (await api.get("/extranet/client/quotes")).data.data,
  });
}

export function useClientPrestations() {
  return useQuery({
    queryKey: ["extranet", "client", "prestations"],
    queryFn: async () => (await api.get("/extranet/client/prestations")).data.data,
  });
}
