import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// =========================================================================
// Télégestion
// =========================================================================

export type QrCode = {
  id: number;
  code: string;
  address_id: number | null;
  status: "valid" | "obsolete" | "invalid" | "to_validate";
  type: "qrcode" | "nfc";
  expires_at: string | null; // audit 2026-05-19
  generated_at?: string;
  rotated_at?: string | null;
  [k: string]: any;
};

/**
 * audit 2026-05-19 — typage aligné sur le backend `telemanagement_logs` :
 * - `called_at` (et non `scanned_at`)
 * - `event_type` arrival/departure (et non `action` in/out)
 * - `origin` mobile/manual/landline (et non `source`)
 * - `comment` (et non `manual_reason`)
 */
export type CheckinLog = {
  id: number;
  intervention_id: number | null;
  employee_id: number;
  client_id: number | null;
  event_type: "arrival" | "departure" | "unrecognized";
  origin: "mobile" | "manual" | "landline" | null;
  called_at: string;
  is_unrecognized: boolean;
  comment: string | null;
  employee?: { id: number; name: string } | null;
  client?: { id: number; code: string } | null;
  [k: string]: any;
};

export function useQrCodes(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ["telemanagement", "qr-codes", params],
    queryFn: async () => {
      const { data } = await api.get<{ data: QrCode[] }>("/telemanagement/qr-codes", { params });
      return data.data;
    },
  });
}

export function useGenerateQrCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      address_id: number;
      type?: "qrcode" | "nfc";
      expires_at?: string | null; // audit 2026-05-19
    }) => {
      const { data } = await api.post<{ data: QrCode }>("/telemanagement/qr-codes", {
        type: "qrcode",
        ...payload,
      });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telemanagement", "qr-codes"] }),
  });
}

/**
 * audit 2026-05-19 — payload aligné sur le backend
 * (event_type arrival/departure + employee_id obligatoire).
 */
export function useBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      qr_code: string;
      employee_id: number;
      event_type: "arrival" | "departure";
      intervention_id?: number | null;
      latitude?: number;
      longitude?: number;
    }) => {
      const { data } = await api.post("/telemanagement/badge", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telemanagement"] }),
  });
}

/**
 * audit 2026-05-19 — payload aligné sur TelemanagementController::manualEntry
 * (employee_id + intervention_id requis ; checkin_time/checkout_time ; comment).
 */
export function useManualEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      intervention_id: number;
      checkin_time?: string | null;
      checkout_time?: string | null;
      comment?: string;
    }) => {
      const { data } = await api.post("/telemanagement/manual-entry", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telemanagement"] }),
  });
}

export function useCheckinLogs(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ["telemanagement", "logs", params],
    queryFn: async () => {
      const { data } = await api.get<{ data: CheckinLog[] }>("/telemanagement/logs", { params });
      return data.data;
    },
  });
}

// =========================================================================
// Stock par entité
// =========================================================================

export type StockProduct = {
  id: number;
  entity_id: number;
  category_id: number | null;
  name: string;
  reference: string | null;
  unit: "unit" | "liter" | "kg" | "pack";
  alert_threshold: number;
  current_quantity: number;
  status: "active" | "inactive";
  category?: { id: number; label: string } | null;
  [k: string]: any;
};

export type StockMovement = {
  id: number;
  stock_product_id: number;
  movement_type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string | null;
  done_by: number | null;
  movement_date: string;
  doneBy?: { id: number; name: string } | null;
  [k: string]: any;
};

export function useStockProducts(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ["stock", "products", params],
    queryFn: async () => {
      const { data } = await api.get("/stock/products", { params });
      return data.data as { data: StockProduct[]; meta?: any };
    },
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: ["stock", "alerts"],
    queryFn: async () => {
      const { data } = await api.get<{ data: StockProduct[] }>("/stock/alerts");
      return data.data;
    },
  });
}

export function useCreateStockProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<StockProduct>) => {
      const { data } = await api.post<{ data: StockProduct }>("/stock/products", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });
}

export function useUpdateStockProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<StockProduct> }) => {
      const { data } = await api.patch<{ data: StockProduct }>(`/stock/products/${id}`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });
}

export function useStockMovements(productId: number | null) {
  return useQuery({
    queryKey: ["stock", "movements", productId],
    queryFn: async () => {
      const { data } = await api.get(`/stock/products/${productId}/movements`);
      return data.data as { data: StockMovement[] };
    },
    enabled: !!productId,
  });
}

export function useCreateStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, payload }: { productId: number; payload: any }) => {
      const { data } = await api.post(`/stock/products/${productId}/movements`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });
}

// =========================================================================
// Portail client
// =========================================================================

export type ClientRequest = {
  id: number;
  client_id: number;
  type: "complaint" | "request" | "feedback";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  [k: string]: any;
};

export type ClientReorder = {
  id: number;
  client_id: number;
  product_name: string;
  quantity: number;
  status: "pending" | "approved" | "delivered" | "cancelled";
  notes: string | null;
  [k: string]: any;
};

export type QualityControl = {
  id: number;
  client_id: number;
  intervention_id: number | null;
  rating: number;
  comment: string | null;
  control_date: string;
  [k: string]: any;
};

export function useClientRequests(clientId: number | null) {
  return useQuery({
    queryKey: ["portal", "requests", clientId],
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientRequest[] }>(`/clients/${clientId}/portal/requests`);
      return data.data;
    },
    enabled: !!clientId,
  });
}

export function useCreateClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, payload }: { clientId: number; payload: Partial<ClientRequest> }) => {
      const { data } = await api.post(`/clients/${clientId}/portal/requests`, payload);
      return data.data;
    },
    // Cascade : on touche au même table `client_requests` que le module Tickets
    // global → invalider toutes les vues qui en dépendent pour éviter les caches
    // incohérents (cf. learnings 2026-05-15 sur cascade invalidation).
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal"] });
      qc.invalidateQueries({ queryKey: ["client-requests"] });
      qc.invalidateQueries({ queryKey: ["extranet", "client", "tickets"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useClientReorders(clientId: number | null) {
  return useQuery({
    queryKey: ["portal", "reorders", clientId],
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientReorder[] }>(`/clients/${clientId}/portal/reorders`);
      return data.data;
    },
    enabled: !!clientId,
  });
}

export function useCreateClientReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, payload }: { clientId: number; payload: Partial<ClientReorder> }) => {
      const { data } = await api.post(`/clients/${clientId}/portal/reorders`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal"] }),
  });
}

export function useQualityControls(clientId: number | null) {
  return useQuery({
    queryKey: ["portal", "quality", clientId],
    queryFn: async () => {
      const { data } = await api.get<{ data: QualityControl[] }>(`/clients/${clientId}/portal/quality-controls`);
      return data.data;
    },
    enabled: !!clientId,
  });
}

export function useCreateQualityControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, payload }: { clientId: number; payload: Partial<QualityControl> }) => {
      const { data } = await api.post(`/clients/${clientId}/portal/quality-controls`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal"] }),
  });
}

// =========================================================================
// Notifications
// =========================================================================

export type Notification = {
  id: number;
  user_id: number | null;
  notification_type_id: number;
  title: string | null;
  body: string | null;
  target_type: string | null;
  target_id: number | null;
  channel: string | null;
  is_read: boolean;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
  [k: string]: any;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get<{ data: Notification[] }>("/notifications");
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>("/notifications/unread-count");
      return data.count;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch(`/notifications/${id}/read`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/notifications/mark-all-read");
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
