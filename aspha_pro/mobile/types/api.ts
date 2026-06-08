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
