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
