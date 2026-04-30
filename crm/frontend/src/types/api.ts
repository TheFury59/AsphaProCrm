// Shapes API renvoyées par le backend Laravel.

export type Service = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  default_hourly_rate: number;
  default_duration_minutes: number;
  color: string;
  is_active: boolean;
};

export type Employee = {
  id: number;
  site_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  mobile: string | null;
  address: {
    line1: string | null;
    postal_code: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };
  status: "active" | "on_leave" | "inactive";
  current_contract: {
    id: number;
    position: string;
    weekly_hours: number;
    contract_type: string;
  } | null;
};

export type ClientAddress = {
  id: number;
  client_id: number;
  label: string;
  line1: string;
  line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  is_default: boolean;
};

export type Client = {
  id: number;
  type: "individual" | "company";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  addresses: ClientAddress[];
};

export type AppointmentStatus = "planned" | "done" | "cancelled" | "no_show";

export type Appointment = {
  id: number;
  service_assignment_id: number;
  employee_id: number | null;
  client_address_id: number;
  scheduled_start: string; // ISO 8601
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: AppointmentStatus;
  paid_to_employee: boolean;
  invoiced_to_client: boolean;
  admin_notes: string | null;
  service: { id: number; name: string; color: string; hourly_rate: number } | null;
  client: { id: number; display_name: string; phone: string | null } | null;
  address: { line1: string; postal_code: string; city: string } | null;
  employee: { id: number; full_name: string } | null;
  recurrence: {
    type: "punctual" | "recurring";
    rule: string | null;
    time: string | null;
  } | null;
};

export type ContractStatus = {
  employee_id: number;
  window: { from: string; to: string; weeks: number };
  weekly_hours: number;
  contract_hours: number;
  hours_planned: number;
  hours_remaining: number;
  fill_rate: number; // %
};

export type ListResponse<T> = { data: T[] };
export type ItemResponse<T> = { data: T };

export type ServiceAssignmentInput =
  | {
      type: "punctual";
      client_id: number;
      client_address_id: number;
      service_id: number;
      default_employee_id: number | null;
      hourly_rate: number | null;
      duration_minutes: number;
      scheduled_date: string; // YYYY-MM-DD
      scheduled_time: string; // HH:mm
      notes?: string;
    }
  | {
      type: "recurring";
      client_id: number;
      client_address_id: number;
      service_id: number;
      default_employee_id: number | null;
      hourly_rate: number | null;
      duration_minutes: number;
      recurrence_start: string; // YYYY-MM-DD
      recurrence_end: string | null;
      recurrence_time: string; // HH:mm
      recurrence_rule: string; // RRULE: FREQ=...
      notes?: string;
    };
