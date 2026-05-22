import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Types
// =========================================================================

export type Address = {
  id: number;
  type: "main" | "billing" | "intervention" | "other";
  address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
};

export type Contact = {
  id: number;
  name: string | null;
  type: "phone" | "email" | "mobile";
  value: string;
  is_primary: boolean;
};

export type RelatedContact = {
  id: number;
  type: "family" | "doctor" | "emergency";
  name: string;
  phone: string;
};

export type ClientAbsence = {
  id: number;
  reason_id: number;
  is_periodic: boolean;
  is_hourly: boolean;
  start_datetime: string | null;
  duration_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
  days_of_week: string | null;
  comment: string | null;
  reason?: { id: number; label: string };
};

export type EmployeeAbsence = ClientAbsence & {
  entry_type: "absence" | "availability" | "unavailability" | "weekly_rest";
};

export type Training = {
  id: number;
  training_phase: "onboarding" | "ongoing";
  title: string;
  training_center: string | null;
  start_date: string | null;
  end_date: string | null;
  hours_count: number | null;
  trainer: string | null;
  is_paid: boolean;
  comment: string | null;
};

export type KeyItem = {
  id: number;
  label: string;
  current_holder: string | null;
};

export type KeyMovement = {
  id: number;
  key_id: number;
  from_holder: string | null;
  to_holder: string;
  date: string;
};

export type DocumentItem = {
  id: number;
  owner_type: string;
  owner_id: number;
  label: string;
  document_type: string;
  is_client_visible: boolean;
  file_path: string;
  download_url: string;
  size_kb: number | null;
  created_at: string | null;
};

export type Skill = { id: number; label: string };
export type AbsenceReason = { id: number; label: string; code?: string; color?: string };
export type ClientAbsenceReason = { id: number; label: string };

type ListResponse<T> = { data: T[] };
type SingleResponse<T> = { data: T };

// =========================================================================
// REFERENTIALS (read-only)
// =========================================================================

export function useSkills() {
  return useQuery({
    queryKey: ["ref", "skills"],
    queryFn: async () => (await api.get<ListResponse<Skill>>("/referentials/skills")).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useClientAbsenceReasons() {
  return useQuery({
    queryKey: ["ref", "client-absence-reasons"],
    queryFn: async () => (await api.get<ListResponse<ClientAbsenceReason>>("/referentials/client-absence-reasons")).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useEmployeeAbsenceReasons() {
  return useQuery({
    queryKey: ["ref", "employee-absence-reasons"],
    queryFn: async () => (await api.get<ListResponse<AbsenceReason>>("/referentials/employee-absence-reasons")).data.data,
    staleTime: 5 * 60_000,
  });
}

// =========================================================================
// CLIENT sub-resources
// =========================================================================

export function useClientContacts(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "contacts"],
    queryFn: async () => (await api.get<ListResponse<Contact>>(`/clients/${clientId}/contacts`)).data.data,
    enabled: !!clientId,
  });
}

/**
 * Helper d'invalidation : toute mutation contact/address d'un client doit
 * aussi invalider le feed planning car le RDV embarque ces infos
 * (téléphone, email, adresse géocodée…). Sinon le calendrier reste stale
 * après une mise à jour client tant qu'on ne rafraîchit pas la page.
 */
function invalidateClientCascade(qc: ReturnType<typeof useQueryClient>, clientId: number, subKey: string) {
  qc.invalidateQueries({ queryKey: ["client", clientId, subKey] });
  qc.invalidateQueries({ queryKey: ["clients"] });
  qc.invalidateQueries({ queryKey: ["interventions"] });
  qc.invalidateQueries({ queryKey: ["planning"] });
}

export function useCreateClientContact(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Contact>) =>
      (await api.post<SingleResponse<Contact>>(`/clients/${clientId}/contacts`, payload)).data.data,
    onSuccess: () => invalidateClientCascade(qc, clientId, "contacts"),
  });
}

export function useDeleteClientContact(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/clients/${clientId}/contacts/${id}`); },
    onSuccess: () => invalidateClientCascade(qc, clientId, "contacts"),
  });
}

export function useClientRelatedContacts(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "related-contacts"],
    queryFn: async () => (await api.get<ListResponse<RelatedContact>>(`/clients/${clientId}/related-contacts`)).data.data,
    enabled: !!clientId,
  });
}

export function useCreateClientRelated(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RelatedContact>) =>
      (await api.post<SingleResponse<RelatedContact>>(`/clients/${clientId}/related-contacts`, payload)).data.data,
    onSuccess: () => invalidateClientCascade(qc, clientId, "related-contacts"),
  });
}

export function useDeleteClientRelated(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/clients/${clientId}/related-contacts/${id}`); },
    onSuccess: () => invalidateClientCascade(qc, clientId, "related-contacts"),
  });
}

export function useClientAddresses(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "addresses"],
    queryFn: async () => (await api.get<ListResponse<Address>>(`/clients/${clientId}/addresses`)).data.data,
    enabled: !!clientId,
  });
}

export function useCreateClientAddress(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Address>) =>
      (await api.post<SingleResponse<Address>>(`/clients/${clientId}/addresses`, payload)).data.data,
    onSuccess: () => invalidateClientCascade(qc, clientId, "addresses"),
  });
}

export function useDeleteClientAddress(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/clients/${clientId}/addresses/${id}`); },
    onSuccess: () => invalidateClientCascade(qc, clientId, "addresses"),
  });
}

/**
 * Update partiel d'une adresse client (manquait — utile pour les
 * EditableField sur la fiche). Invalide aussi le planning car le calendar
 * embarque les adresses géocodées.
 */
export function useUpdateClientAddress(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Address> }) =>
      (await api.patch<SingleResponse<Address>>(`/clients/${clientId}/addresses/${id}`, patch)).data.data,
    onSuccess: () => invalidateClientCascade(qc, clientId, "addresses"),
  });
}

// === Adresses INTERVENANT ===
// L'adresse (domicile) de l'intervenant est indispensable au calcul de
// proximité de la carte de suggestion d'intervenants (géocodage BAN auto
// via Address::booted). 2026-05-21.

function invalidateEmployeeAddresses(qc: ReturnType<typeof useQueryClient>, employeeId: number) {
  qc.invalidateQueries({ queryKey: ["employee", employeeId, "addresses"] });
  qc.invalidateQueries({ queryKey: ["employee", employeeId] });
  qc.invalidateQueries({ queryKey: ["employees"] });
  // le planning / les suggestions embarquent les coordonnées géocodées
  qc.invalidateQueries({ queryKey: ["planning"] });
}

export function useEmployeeAddresses(employeeId: number) {
  return useQuery({
    queryKey: ["employee", employeeId, "addresses"],
    queryFn: async () => (await api.get<ListResponse<Address>>(`/employees/${employeeId}/addresses`)).data.data,
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeAddress(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Address>) =>
      (await api.post<SingleResponse<Address>>(`/employees/${employeeId}/addresses`, payload)).data.data,
    onSuccess: () => invalidateEmployeeAddresses(qc, employeeId),
  });
}

export function useUpdateEmployeeAddress(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Address> }) =>
      (await api.patch<SingleResponse<Address>>(`/employees/${employeeId}/addresses/${id}`, patch)).data.data,
    onSuccess: () => invalidateEmployeeAddresses(qc, employeeId),
  });
}

export function useDeleteEmployeeAddress(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/employees/${employeeId}/addresses/${id}`); },
    onSuccess: () => invalidateEmployeeAddresses(qc, employeeId),
  });
}

/**
 * Update partiel d'un contact client. Idem cascade planning.
 */
export function useUpdateClientContact(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Contact> }) =>
      (await api.patch<SingleResponse<Contact>>(`/clients/${clientId}/contacts/${id}`, patch)).data.data,
    onSuccess: () => invalidateClientCascade(qc, clientId, "contacts"),
  });
}

export function useClientAbsences(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "absences"],
    queryFn: async () => (await api.get<ListResponse<ClientAbsence>>(`/clients/${clientId}/absences`)).data.data,
    enabled: !!clientId,
  });
}

export function useCreateClientAbsence(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ClientAbsence>) =>
      (await api.post<SingleResponse<ClientAbsence>>(`/clients/${clientId}/absences`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId, "absences"] }),
  });
}

export function useDeleteClientAbsence(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/clients/${clientId}/absences/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId, "absences"] }),
  });
}

export function useClientKeys(clientId: number) {
  return useQuery({
    queryKey: ["client", clientId, "keys"],
    queryFn: async () => (await api.get<ListResponse<KeyItem>>(`/clients/${clientId}/keys`)).data.data,
    enabled: !!clientId,
  });
}

export function useCreateClientKey(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<KeyItem>) =>
      (await api.post<SingleResponse<KeyItem>>(`/clients/${clientId}/keys`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId, "keys"] }),
  });
}

export function useDeleteClientKey(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/clients/${clientId}/keys/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId, "keys"] }),
  });
}

export function useKeyMovements(clientId: number, keyId: number | null) {
  return useQuery({
    queryKey: ["client", clientId, "key", keyId, "movements"],
    enabled: !!clientId && !!keyId,
    queryFn: async () => (await api.get<ListResponse<KeyMovement>>(`/clients/${clientId}/keys/${keyId}/movements`)).data.data,
  });
}

export function useCreateKeyMovement(clientId: number, keyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<KeyMovement>) =>
      (await api.post<SingleResponse<KeyMovement>>(`/clients/${clientId}/keys/${keyId}/movements`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", clientId, "keys"] });
      qc.invalidateQueries({ queryKey: ["client", clientId, "key", keyId, "movements"] });
    },
  });
}

// =========================================================================
// EMPLOYEE sub-resources
// =========================================================================

export function useEmployeeAbsences(employeeId: number, entryType?: string) {
  const qs = entryType ? `?entry_type=${entryType}` : "";
  return useQuery({
    queryKey: ["employee", employeeId, "absences", entryType],
    queryFn: async () => (await api.get<ListResponse<EmployeeAbsence>>(`/employees/${employeeId}/absences${qs}`)).data.data,
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeAbsence(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmployeeAbsence>) =>
      (await api.post<SingleResponse<EmployeeAbsence>>(`/employees/${employeeId}/absences`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", employeeId, "absences"] }),
  });
}

export function useDeleteEmployeeAbsence(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/employees/${employeeId}/absences/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", employeeId, "absences"] }),
  });
}

export function useEmployeeTrainings(employeeId: number) {
  return useQuery({
    queryKey: ["employee", employeeId, "trainings"],
    queryFn: async () => (await api.get<ListResponse<Training>>(`/employees/${employeeId}/trainings`)).data.data,
    enabled: !!employeeId,
  });
}

export function useCreateTraining(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Training>) =>
      (await api.post<SingleResponse<Training>>(`/employees/${employeeId}/trainings`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", employeeId, "trainings"] }),
  });
}

export function useDeleteTraining(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/employees/${employeeId}/trainings/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", employeeId, "trainings"] }),
  });
}

export function useSyncEmployeeSkills(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillIds: number[]) =>
      (await api.put<ListResponse<Skill>>(`/employees/${employeeId}/skills`, { skill_ids: skillIds })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees", employeeId] }),
  });
}

// =========================================================================
// DOCUMENTS (polymorphic)
// =========================================================================

export function useDocuments(ownerType: string, ownerId: number) {
  return useQuery({
    queryKey: ["documents", ownerType, ownerId],
    enabled: !!ownerId,
    queryFn: async () => (await api.get<ListResponse<DocumentItem>>(`/documents?owner_type=${ownerType}&owner_id=${ownerId}`)).data.data,
  });
}

export function useUploadDocument(ownerType: string, ownerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { file: File; label: string; document_type: string; is_client_visible?: boolean }) => {
      const fd = new FormData();
      fd.append("owner_type", ownerType);
      fd.append("owner_id", String(ownerId));
      fd.append("file", payload.file);
      fd.append("label", payload.label);
      fd.append("document_type", payload.document_type);
      if (payload.is_client_visible) fd.append("is_client_visible", "1");
      const res = await api.post<SingleResponse<DocumentItem>>("/documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", ownerType, ownerId] }),
  });
}

export function useDeleteDocument(ownerType: string, ownerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/documents/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", ownerType, ownerId] }),
  });
}
