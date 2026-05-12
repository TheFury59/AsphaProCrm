import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type MessageThread = {
  id: number;
  subject: string | null;
  type: "direct" | "group" | "telemanagement";
  created_at: string;
  last_message: { id: number; body: string; sent_at: string; sender_id: number } | null;
  messages_count: number;
  unread_count: number;
  created_by: { id: number; name: string } | null;
};

export type Message = {
  id: number;
  thread_id: number;
  sender_id: number | null;
  body: string;
  sent_at: string;
  sender?: { id: number; name: string };
};

export function useThreads() {
  return useQuery({
    queryKey: ["messaging", "threads"],
    queryFn: async () => {
      const { data } = await api.get<{ data: MessageThread[] }>("/messaging/threads");
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useThread(id: number | null) {
  return useQuery({
    queryKey: ["messaging", "thread", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/messaging/threads/${id}`);
      return data.data as { thread: any; messages: { data: Message[] } };
    },
    refetchInterval: 10_000,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      subject?: string;
      type: "direct" | "group" | "telemanagement";
      participant_ids: number[];
      initial_message?: string;
    }) => {
      const { data } = await api.post("/messaging/threads", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messaging"] }),
  });
}

export function usePostMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: number; body: string }) => {
      const { data } = await api.post(`/messaging/threads/${threadId}/messages`, { body });
      return data.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["messaging", "thread", vars.threadId] });
      qc.invalidateQueries({ queryKey: ["messaging", "threads"] });
      qc.invalidateQueries({ queryKey: ["messaging", "unread"] });
    },
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: number) => {
      await api.post(`/messaging/threads/${threadId}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messaging"] }),
  });
}

export function useMessagingUnread() {
  return useQuery({
    queryKey: ["messaging", "unread"],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>("/messaging/unread-total");
      return data.count;
    },
    refetchInterval: 30_000,
  });
}
