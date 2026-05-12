import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Appointment,
  Client,
  ContractStatus,
  Employee,
  ItemResponse,
  ListResponse,
  Service,
  ServiceAssignmentInput,
} from "@/types/api";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.get<ListResponse<Service>>("/services")).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<ListResponse<Employee>>("/employees")).data.data,
    staleTime: 60_000,
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<ListResponse<Client>>("/clients")).data.data,
    staleTime: 60_000,
  });
}

type AppointmentsQueryParams = {
  from: string;
  to: string;
  employee_id?: number | null;
  client_id?: number | null;
};

export function useAppointments(params: AppointmentsQueryParams) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: async () => {
      const qs = new URLSearchParams({ from: params.from, to: params.to });
      if (params.employee_id) qs.set("employee_id", String(params.employee_id));
      if (params.client_id) qs.set("client_id", String(params.client_id));
      const res = await api.get<ListResponse<Appointment>>(`/appointments?${qs.toString()}`);
      return res.data.data;
    },
    staleTime: 15_000,
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Appointment> & { scheduled_start?: string; scheduled_end?: string } }) => {
      const res = await api.patch<ItemResponse<Appointment>>(`/appointments/${id}`, patch);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["contract-status"] });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/appointments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["contract-status"] });
    },
  });
}

export function useCreateServiceAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceAssignmentInput) => {
      const res = await api.post("/service-assignments", input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["contract-status"] });
    },
  });
}

export function useContractStatus(employeeId: number | null, from: string, to: string) {
  return useQuery({
    queryKey: ["contract-status", employeeId, from, to],
    enabled: !!employeeId,
    queryFn: async () => {
      const res = await api.get<ContractStatus>(
        `/employees/${employeeId}/contract-status?from=${from}&to=${to}`
      );
      return res.data;
    },
    staleTime: 30_000,
  });
}
