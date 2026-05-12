// Types des réponses API V1 — Aspha Pro

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
};

export type Single<T> = { data: T };

// === CLIENT ===
export type ClientStatus = "active" | "inactive" | "suspended";

export type ClientCompany = {
  company_name: string;
  legal_form: string | null;
  siret: string | null;
  vat_number: string | null;
  manager_civility: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_role: string | null;
  phone_landline: string | null;
  phone_mobile: string | null;
  primary_email: string | null;
  photo: string | null;
  allow_duplicate: boolean;
};

export type ClientBillingContact = {
  civility: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

export type ClientAddress = {
  id: number;
  type: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
};

export type ClientContact = {
  id: number;
  type: string;
  value: string;
  is_primary: boolean;
};

export type ClientRelatedContact = {
  id: number;
  type: string;
  name: string;
  phone: string;
};

export type Client = {
  id: number;
  code: string;
  status: ClientStatus;
  entity_id: number;
  owner_user_id: number | null;
  print_intervention_detail: string | null;
  display_name: string;
  created_at: string | null;
  company?: ClientCompany | null;
  billing_contact?: ClientBillingContact | null;
  entity?: { id: number; name: string } | null;
  owner_user?: { id: number; name: string } | null;
  addresses?: ClientAddress[];
  contacts?: ClientContact[];
  related_contacts?: ClientRelatedContact[];
  counts?: {
    missions?: number;
    prestations?: number;
    absences?: number;
    keys?: number;
    invoices?: number;
    quotes?: number;
  };
};

// === EMPLOYEE ===
export type EmployeeClassification = "non_cadre" | "cadre";

export type EmployeeContract = {
  id: number;
  position: string | null;
  intervention_zone: string | null;
  contract_type: string | null;
  work_time_type: string | null;
  monthly_duration: number | null;
  weekly_duration: number | null;
  pay_mode: string | null;
  monthly_salary: number | null;
  hourly_rate: number | null;
  km_rate_inter_vacation: number | null;
  km_rate_intervention: number | null;
  start_date: string | null;
};

export type Employee = {
  id: number;
  user_id: number | null;
  entity_id: number;
  owner_user_id: number | null;
  name: string;
  full_name: string;
  phone: string | null;
  classification: EmployeeClassification;
  transport_mode: string | null;
  has_company_vehicle: boolean;
  diploma: string | null;
  job_reference_free: string | null;
  created_at: string | null;
  user?: { id: number; name: string; email: string; status: string } | null;
  entity?: { id: number; name: string } | null;
  owner_user?: { id: number; name: string } | null;
  current_contract?: EmployeeContract | null;
  skills?: { id: number; label: string }[];
  addresses?: ClientAddress[];
  counts?: {
    contracts?: number;
    absences?: number;
    trainings?: number;
    interventions?: number;
    salary_deductions?: number;
  };
};

// === PRODUCT ===
export type ProductType = "hourly" | "forfait" | "frais" | "remise" | "carte" | "exceptional";
export type ProductNature = "regular" | "punctual";
export type ProductBillingMode = "per_intervention" | "per_month" | "per_week" | "per_unit";

export type Product = {
  id: number;
  code: string;
  status: "active" | "inactive";
  name: string;
  entity_id: number | null;
  type: ProductType;
  nature: ProductNature;
  billing_mode: ProductBillingMode;
  category_id: number | null;
  default_duration_minutes: number | null;
  has_degressive_pricing: boolean;
  price: number;
  cost: number;
  vat_rate_id: number | null;
  amount_incl_tax: boolean;
  specific_rates_forbidden: boolean;
  accounting_code: string | null;
  chapter: string | null;
  description: string | null;
  created_at: string | null;
  category?: { id: number; label: string } | null;
  vat_rate?: { id: number; label: string; rate: number } | null;
  price_tiers?: { id: number; from_quantity: number; price: number }[];
};
