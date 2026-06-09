// Types API V1 — version mobile (sous-ensemble aligne sur frontend/src/types/api.ts).
// On garde uniquement ce qui est utile cote mobile pour limiter la surface.

export type ApiResponse<T> = { data: T };

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

// === AUTH USER ===
// Shape identique au /me du web (cf. frontend/src/stores/auth.ts).
// Le backend renverra le meme objet pour POST /mobile/login (champ user).
export type UserRole = "super_admin" | "admin" | "intervenant" | "client";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  must_change_password: boolean;
  role: UserRole | null;
  permissions: string[];
  last_login_at: string | null;
  /** URL absolue de l'avatar personnel (null si non uploadé). */
  avatar_url: string | null;
};

// === MOBILE LOGIN ===
export type MobileLoginRequest = {
  email: string;
  password: string;
  device_name: string;
};

export type MobileLoginResponse = {
  data: {
    token: string;
    user: AuthUser;
  };
};

// === MOBILE PUSH TOKEN ===
export type MobilePushTokenRequest = {
  expo_push_token: string;
};

// === API ERROR (forme Laravel/Sanctum standard) ===
export type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

// === TICKETS / SIGNALEMENTS ===
// Le backend ne distingue pas « ticket » de « signalement » : c'est la
// meme entite ClientRequest, mais avec un champ `type` qui differencie
// reclamation / signalement / reassort.
export type TicketType = "complaint" | "problem_report" | "consumable_reorder";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketClientCompany = {
  id: number;
  client_id: number;
  company_name: string;
  photo: string | null;
  updated_at: string;
};

export type TicketClient = {
  id: number;
  code: string;
  company?: TicketClientCompany | null;
};

export type Ticket = {
  id: number;
  client_id: number;
  type: TicketType;
  subject: string;
  body: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  client?: TicketClient | null;
};

export type TicketMessage = {
  id: number;
  client_request_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  sender: { id: number; name: string } | null;
};

export type MyClient = {
  id: number;
  code: string;
  company?: TicketClientCompany | null;
};

export type CreateTicketRequest = {
  client_id: number;
  type: TicketType;
  subject: string;
  body?: string | null;
  priority?: TicketPriority;
};

// === CLIENT — DEVIS / FACTURES / PROFIL ===
// Statuts d'un devis cote backend : draft (non visible client), sent (en attente
// de validation), accepted (valide par le client), refused (refuse par le client).
// Le mobile ne voit jamais les `draft` (filtres backend).
export type QuoteStatus = "sent" | "accepted" | "refused" | "draft";

export type QuoteItem = {
  id: number;
  quote_id: number;
  label: string;
  quantity: string | number;
  unit_price: string | number;
  total: string | number;
  duration_minutes?: number | null;
  order?: number | null;
};

export type Quote = {
  id: number;
  reference: string | null;
  client_id: number;
  status: QuoteStatus;
  total: string | number;
  quote_date: string | null;
  validity_date: string | null;
  comment: string | null;
  items?: QuoteItem[];
};

// Statut paiement facture cote backend. On reste sur le superset complet pour
// matcher tout ce qui peut sortir : draft / sent / paid / partial / overdue / cancelled.
export type InvoicePaymentStatus =
  | "paid"
  | "partial"
  | "unpaid"
  | "overdue"
  | "pending";

export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled" | string;

export type Invoice = {
  id: number;
  reference: string | null;
  client_id: number;
  status: InvoiceStatus;
  payment_status: string | null;
  type: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: string | number;
};

// Logo URL est exposé via l'accessor `logo_url` (cf. ClientCompany model).
export type ClientCompanyShape = {
  id: number;
  client_id: number;
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
  logo_url: string | null;
};

export type ClientAddress = {
  id: number;
  type: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ClientContact = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

export type ClientProfile = {
  id: number;
  code: string;
  status: string;
  company?: ClientCompanyShape | null;
  addresses?: ClientAddress[];
  contacts?: ClientContact[];
};

export type CreateClientTicketRequest = {
  type: TicketType;
  subject: string;
  body?: string | null;
  priority?: TicketPriority;
};
