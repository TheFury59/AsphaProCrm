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

export type Quote = {
  id: number;
  client_id: number;
  entity_id: number;
  quote_date: string;
  validity_date: string | null;
  nature: string | null;
  status: "draft" | "sent" | "accepted" | "refused" | "expired";
  comment: string | null;
  client?: { id: number; client_companies?: any[] } | null;
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
  invoice_items?: InvoiceItem[];
  client?: { id: number; client_companies?: any[] } | null;
};

export type InvoiceItem = {
  id: number;
  label: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
};

type Paginated<T> = { data: T[]; meta: any; links: any };
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
  occurrence_date: string;
  start_datetime: string;
  end_datetime: string;
  status: string | null;
  client?: { id: number; code: string } | null;
  employee?: { id: number; name: string } | null;
  comment: string | null;
  frequency: string | null;
  days_of_week: string | null;
};

/**
 * Feed du calendrier — utilise /interventions/calendar qui retourne
 * les ponctuelles + les occurrences virtuelles des récurrentes
 * expansées dans la fenêtre [from, to].
 */
export function useInterventions(params: InterventionParams = {}) {
  return useQuery({
    queryKey: ["interventions", "calendar", params],
    enabled: !!params.from && !!params.to,
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

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Intervention>) =>
      (await api.post<Single<Intervention>>("/interventions", payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
  });
}

export function useUpdateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Intervention> }) =>
      (await api.patch<Single<Intervention>>(`/interventions/${id}`, patch)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
  });
}

export function useDeleteIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/interventions/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
  });
}

// =========================================================================
// QUOTES (Phase 3)
// =========================================================================

export function useQuotes(params: { page?: number; per_page?: number; search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["quotes", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      return (await api.get<Paginated<Quote>>(`/quotes?${qs}`)).data;
    },
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Quote>) =>
      (await api.post<Single<Quote>>("/quotes", payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

// =========================================================================
// INVOICES (Phase 3)
// =========================================================================

export function useInvoices(params: { page?: number; per_page?: number; search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      if (params.search) qs.set("filter[search]", params.search);
      if (params.status) qs.set("filter[status]", params.status);
      return (await api.get<Paginated<Invoice>>(`/invoices?${qs}`)).data;
    },
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
