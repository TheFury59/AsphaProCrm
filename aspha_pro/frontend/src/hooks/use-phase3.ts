import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Types (Sprint B + Phase 3 minimaux)
// =========================================================================

export type Contract = {
  id: number;
  employee_id: number;
  entity_id: number;
  position: string | null;
  intervention_zone: string | null;
  contract_type: "cdi" | "cdd" | "stage" | null;
  work_time_type: "full_time" | "part_time" | null;
  monthly_duration: number | null;
  weekly_duration: number | null;
  pay_mode: "monthly_salary" | "hourly_salary" | null;
  monthly_salary: number | null;
  hourly_rate: number | null;
  km_rate_inter_vacation: number | null;
  km_rate_intervention: number | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  comment: string | null;
  [k: string]: any;
};

export type SalaryDeduction = {
  id: number;
  employee_id: number;
  creditor_name: string;
  case_number: string | null;
  address: string | null;
  payment_method: string;
  comment: string | null;
  salary_deduction_debts?: SalaryDeductionDebt[];
  deduction_payments?: DeductionPayment[];
};

export type SalaryDeductionDebt = {
  id: number;
  type: string;
  total_due: number;
  amount_paid: number | null;
  balance: number | null;
  start_date: string | null;
  end_date: string | null;
};

export type DeductionPayment = {
  id: number;
  amount: number;
  paid_at: string;
  method: string | null;
  note: string | null;
};

export type Intervention = {
  id: number;
  client_id: number;
  employee_id: number | null;
  mission_id: number | null;
  is_recurring: boolean;
  status: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  recurrence_start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
  days_of_week: string | null;
  comment: string | null;
  employee?: { id: number; name: string } | null;
  client?: { id: number; code: string } | null;
};

export type QuoteItem = {
  id: number;
  quote_id: number;
  label: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
  order: number;
  // 2026-05-20 refonte devis — traçabilité catalogue + TVA par ligne
  product_id?: number | null;
  vat_rate_id?: number | null;
};

export type Quote = {
  id: number;
  reference: string | null;
  client_id: number;
  entity_id: number;
  // 2026-05-20 refonte devis — origine du devis
  quote_type_id?: number | null;
  mission_id?: number | null;
  quote_date: string;
  validity_date: string | null;
  nature: string | null;
  status: "draft" | "sent" | "accepted" | "refused" | "expired";
  comment: string | null;
  total: number;
  success_rate?: number | null;
  pennylane_id?: string | null;
  pennylane_synced_at?: string | null;
  items?: QuoteItem[];
  client?: { id: number; company?: { company_name?: string | null } | null } | null;
};

export type Invoice = {
  id: number;
  reference: string;
  client_id: number;
  entity_id: number;
  invoice_date: string;
  due_date: string | null;
  type: string;
  status: string;
  payment_status: string;
  total: number;
  comment: string | null;
  pennylane_id?: string | null;
  pennylane_synced_at?: string | null;
  invoice_items?: InvoiceItem[];
  reglement_invoice_lines?: Array<{ id: number; reglement_id: number; allocated_amount: number; reglement?: { id: number; reference: string; operation_date: string; payment_method: string } | null }>;
  client?: { id: number; company?: { company_name?: string | null } | null } | null;
};

export type InvoiceItem = {
  id: number;
  label: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
};

// 2026-05-20 refonte devis — retiré le type mort `Paginated<T>` (jamais référencé,
// ce fichier utilise son propre helper `unwrapPaginated`).
type ListResp<T> = { data: T[] };
type Single<T> = { data: T };

// =========================================================================
// CONTRACTS (Sprint B)
// =========================================================================

export function useEmployeeContracts(employeeId: number) {
  return useQuery({
    queryKey: ["employee", employeeId, "contracts"],
    enabled: !!employeeId,
    queryFn: async () => (await api.get<ListResp<Contract>>(`/employees/${employeeId}/contracts`)).data.data,
  });
}

export function useCreateContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Contract>) =>
      (await api.post<Single<Contract>>(`/employees/${employeeId}/contracts`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", employeeId, "contracts"] });
      qc.invalidateQueries({ queryKey: ["employees", employeeId] });
    },
  });
}

export function useUpdateContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Contract> }) =>
      (await api.patch<Single<Contract>>(`/employees/${employeeId}/contracts/${id}`, patch)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", employeeId, "contracts"] });
      qc.invalidateQueries({ queryKey: ["employees", employeeId] });
    },
  });
}

// =========================================================================
// SALARY DEDUCTIONS (Sprint B)
// =========================================================================

export function useSalaryDeductions(employeeId: number) {
  return useQuery({
    queryKey: ["employee", employeeId, "salary-deductions"],
    enabled: !!employeeId,
    queryFn: async () => (await api.get<ListResp<SalaryDeduction>>(`/employees/${employeeId}/salary-deductions`)).data.data,
  });
}

export function useCreateSalaryDeduction(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SalaryDeduction>) =>
      (await api.post<Single<SalaryDeduction>>(`/employees/${employeeId}/salary-deductions`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", employeeId, "salary-deductions"] }),
  });
}

export function useDeleteSalaryDeduction(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/employees/${employeeId}/salary-deductions/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", employeeId, "salary-deductions"] }),
  });
}

// =========================================================================
// INTERVENTIONS (Phase 3)
// =========================================================================

type InterventionParams = {
  from?: string;
  to?: string;
  employee_id?: number;
  client_id?: number;
  /** Désactive le fetch si false (utile pour exiger un filtre avant requête). */
  enabled?: boolean;
};

/**
 * Type d'un événement calendrier (occurrence virtuelle ou ponctuelle expansée).
 * Différent d'Intervention (la ligne de BDD) : un Intervention récurrent
 * génère N CalendarEvents virtuels.
 */
export type CalendarEvent = {
  id: string;                    // "12-20260512" pour occurrence, "12" pour ponctuelle
  intervention_id: number;
  is_occurrence: boolean;
  is_recurring: boolean;
  is_exception?: boolean;
  occurrence_date: string;
  start_datetime: string;
  end_datetime: string;
  status: string | null;
  client?: {
    id: number;
    code: string;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: { id?: number; type?: string; address: string | null; postal_code: string | null; city: string | null; latitude?: number | null; longitude?: number | null } | null;
    keys_count?: number;
    has_keys?: boolean;
    all_addresses?: Array<{ id: number; type: string; address: string | null; city: string | null; postal_code: string | null; latitude: number | null; longitude: number | null }>;
    all_contacts?: Array<{ id: number; first_name: string | null; last_name: string | null; phone: string | null; email: string | null; role: string | null }>;
  } | null;
  employee?: { id: number; name: string } | null;
  comment: string | null;
  frequency: string | null;
  days_of_week: string | null;
  start_time?: string | null;
  end_time?: string | null;
  bill_client?: boolean;
  is_paid?: boolean;
  is_billed?: boolean;
  prestation?: {
    id: number;
    label: string | null;
    product_name: string | null;
    unit_price: number;
    billing_type: string | null;
    pricing_type: string | null;
    default_duration_minutes: number | null;
  } | null;
  checkin?: {
    id: number;
    checkin_time: string | null;
    checkout_time: string | null;
  } | null;
  key_id?: number | null;
  assigned_key?: { id: number; label: string; current_holder: string | null } | null;
  client_keys?: Array<{ id: number; label: string; current_holder: string | null }>;
  address_id?: number | null;
  contact_id?: number | null;
  internal_comment?: string | null;
  transport_mode?: string | null;
  vehicle_type?: string | null;
};

/**
 * Feed du calendrier — utilise /interventions/calendar qui retourne
 * les ponctuelles + les occurrences virtuelles des récurrentes
 * expansées dans la fenêtre [from, to].
 */
export function useInterventions(params: InterventionParams = {}) {
  // Si `enabled` est explicitement passé (false), on respecte. Sinon : fetch si from+to présents.
  const isEnabled = params.enabled === undefined
    ? (!!params.from && !!params.to)
    : (params.enabled && !!params.from && !!params.to);
  return useQuery({
    queryKey: ["interventions", "calendar", params],
    enabled: isEnabled,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.from) qs.set("from", params.from);
      if (params.to) qs.set("to", params.to);
      if (params.employee_id) qs.set("employee_id", String(params.employee_id));
      if (params.client_id) qs.set("client_id", String(params.client_id));
      const res = await api.get<{ data: CalendarEvent[] }>(`/interventions/calendar?${qs}`);
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/**
 * Invalide TOUS les caches dépendants d'une intervention :
 *  - liste/calendar des interventions
 *  - "planning/*" : contract-summary, trips, long-absences, available-employees
 *  - matching (suggestions qui dépendent de la liste des employés)
 *
 * Appelé après chaque mutation (create/update/delete/exception) pour que les
 * panneaux latéraux (Trajets, Contrats, Bandeau absences) se mettent à jour
 * sans rafraîchir la page.
 */
function invalidatePlanningRelated(qc: ReturnType<typeof useQueryClient>) {
  // refetchType: 'active' force le re-fetch IMMÉDIAT des queries actuellement
  // mountées (= visibles à l'écran). Sans ce paramètre, les queries sont
  // juste marquées "stale" et ne refetchent qu'au prochain mount/focus,
  // donnant l'impression que le calendar ne se rafraîchit pas après création.
  qc.invalidateQueries({ queryKey: ["interventions"], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["planning"], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["matching"], refetchType: "active" });
  // TripSummaryPanel + ContractSummaryPanel s'appuient sur les mêmes
  // données ; ils utilisent leur propre query mais via les mêmes hooks.
}

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Intervention>) =>
      (await api.post<Single<Intervention>>("/interventions", payload)).data.data,
    onSuccess: () => invalidatePlanningRelated(qc),
  });
}

export function useUpdateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Intervention> }) =>
      (await api.patch<Single<Intervention>>(`/interventions/${id}`, patch)).data.data,
    onSuccess: () => invalidatePlanningRelated(qc),
  });
}

export function useDeleteIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/interventions/${id}`); },
    onSuccess: () => invalidatePlanningRelated(qc),
  });
}

// =========================================================================
// QUOTES (Phase 3)
// =========================================================================

/**
 * Normalise la réponse pagination Laravel qui arrive double-wrappée :
 *   - axios body : { data: { current_page, data: [...], total, last_page, per_page, ... } }
 *     (le wrap externe = `['data' => $paginate]` côté controller ;
 *      le wrap interne = format paginate() Laravel)
 * Retour normalisé : { data: T[], meta: { total, current_page, last_page, per_page } }
 */
function unwrapPaginated<T>(body: any): { data: T[]; meta: { total: number; current_page: number; last_page: number; per_page: number } } {
  // Cas 1 : `['data' => paginate]` → body.data = pagination Laravel
  // Cas 2 : `paginate` directement → body = pagination Laravel
  const p = body?.data && typeof body.data === "object" && Array.isArray(body.data.data)
    ? body.data
    : body;
  return {
    data: Array.isArray(p?.data) ? p.data : [],
    meta: {
      total: p?.total ?? p?.meta?.total ?? 0,
      current_page: p?.current_page ?? p?.meta?.current_page ?? 1,
      last_page: p?.last_page ?? p?.meta?.last_page ?? 1,
      per_page: p?.per_page ?? p?.meta?.per_page ?? 25,
    },
  };
}

export function useQuotes(params: { page?: number; per_page?: number; search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["quotes", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      const res = await api.get<any>(`/quotes?${qs}`);
      return unwrapPaginated<Quote>(res.data);
    },
  });
}

export function useQuote(id: number | null) {
  return useQuery({
    queryKey: ["quotes", id],
    enabled: !!id,
    queryFn: async () => (await api.get<Single<Quote>>(`/quotes/${id}`)).data.data,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post<Single<Quote>>("/quotes", payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) =>
      (await api.patch<Single<Quote>>(`/quotes/${id}`, patch)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/quotes/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useConvertQuoteToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: number) =>
      (await api.post<Single<Invoice>>(`/quotes/${quoteId}/convert-to-invoice`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// =========================================================================
// INVOICES (Phase 3)
// =========================================================================

export function useInvoices(params: { page?: number; per_page?: number; search?: string; status?: string; payment_status?: string } = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      if (params.payment_status) qs.set("filter[payment_status]", params.payment_status);
      const res = await api.get<any>(`/invoices?${qs}`);
      return unwrapPaginated<Invoice>(res.data);
    },
  });
}

export function useInvoice(id: number | null) {
  return useQuery({
    queryKey: ["invoices", id],
    enabled: !!id,
    queryFn: async () => (await api.get<Single<Invoice>>(`/invoices/${id}`)).data.data,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post<Single<Invoice>>("/invoices", payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/invoices/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
