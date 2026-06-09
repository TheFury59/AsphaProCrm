// Hooks React Query : messagerie interne (intervenant <-> admins/collègues).
//
// Endpoints (partagés avec le web — pas d'extranet dédié, le backend filtre
// par participation au thread) :
//   GET    /messaging/threads                       — liste mes threads
//   POST   /messaging/threads                       — créer thread + participants
//   GET    /messaging/threads/{id}                  — détail + messages paginés
//   POST   /messaging/threads/{id}/messages         — envoyer message
//   POST   /messaging/threads/{id}/read             — mark all read
//   GET    /messaging/users                         — users invitables (pour new)
//   GET    /messaging/unread-total                  — badge tab
//
// Conventions de cache :
//   ["threads"]                  — liste
//   ["thread", id]               — détail thread (participants)
//   ["thread-messages", id]      — messages du thread (refetch 5 s)
//   ["messageable-users"]        — picker new
//   ["messaging-unread-total"]   — badge

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  ApiResponse,
  MessageThread,
  MessageThreadDetail,
  MessageableUser,
  ThreadMessage,
  ThreadParticipant,
} from "@/types/api";

// === LIST THREADS ===
export function useThreads(): UseQueryResult<MessageThread[], Error> {
  return useQuery<MessageThread[], Error>({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageThread[]>>("/messaging/threads");
      return data.data;
    },
    // Refetch léger : 10 s tant que la liste est visible, pour faire remonter
    // les nouveaux threads / le dernier message sans avoir besoin de pull.
    refetchInterval: 10_000,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

// === THREAD DETAIL (participants) ===
// Le backend renvoie un objet `{ thread, messages: Paginated, can_manage }`.
// On normalise pour exposer thread + messages séparément côté hook.
type ThreadDetailRaw = {
  thread: MessageThreadDetail & { messageThreadParticipants?: ThreadParticipant[] };
  messages: {
    data: ThreadMessage[];
    [k: string]: unknown;
  };
  can_manage: boolean;
};

export function useThread(threadId: number | null): UseQueryResult<
  { thread: MessageThreadDetail; participants: ThreadParticipant[] },
  Error
> {
  return useQuery({
    queryKey: ["thread", threadId],
    enabled: threadId != null,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ThreadDetailRaw>>(
        `/messaging/threads/${threadId}`,
      );
      const t = data.data.thread;
      const participants =
        t.messageThreadParticipants ?? t.message_thread_participants ?? [];
      return { thread: t, participants };
    },
    staleTime: 30_000,
  });
}

// === THREAD MESSAGES (live, refetch 5 s) ===
// On hit `/messaging/threads/{id}` qui renvoie le détail complet et on en
// extrait `messages.data`. Le backend pagine par 50, on garde la 1ère page
// inversée pour l'affichage chat (les plus récents en bas).
export function useThreadMessages(
  threadId: number | null,
): UseQueryResult<ThreadMessage[], Error> {
  return useQuery<ThreadMessage[], Error>({
    queryKey: ["thread-messages", threadId],
    enabled: threadId != null,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ThreadDetailRaw>>(
        `/messaging/threads/${threadId}`,
      );
      // Le backend renvoie en orderByDesc(sent_at) — on inverse pour l'UI chat.
      return [...data.data.messages.data].reverse();
    },
    staleTime: 2_000,
    // Poll 5 s identique tickets — effet « live » sans WebSocket.
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

// === CREATE THREAD ===
export type CreateThreadInput = {
  participant_ids: number[];
  subject?: string | null;
  /** `direct` pour un 1-1 (V1 mobile), `group` au-delà. */
  type?: "direct" | "group";
  initial_message?: string | null;
};

// Le backend renvoie le thread créé sous `{ data: thread }` mais avec une shape
// proche de MessageThreadDetail. On en extrait l'id pour rediriger.
export function useCreateThread(): UseMutationResult<
  { id: number },
  Error,
  CreateThreadInput
> {
  const qc = useQueryClient();
  return useMutation<{ id: number }, Error, CreateThreadInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiResponse<{ id: number }>>(
        "/messaging/threads",
        {
          participant_ids: input.participant_ids,
          subject: input.subject ?? null,
          type: input.type ?? "direct",
          initial_message: input.initial_message ?? null,
        },
      );
      return { id: data.data.id };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["messaging-unread-total"] });
    },
  });
}

// === SEND MESSAGE ===
export function useSendMessage(
  threadId: number,
): UseMutationResult<ThreadMessage, Error, { body: string }> {
  const qc = useQueryClient();
  return useMutation<ThreadMessage, Error, { body: string }>({
    mutationFn: async ({ body }) => {
      const { data } = await api.post<ApiResponse<ThreadMessage>>(
        `/messaging/threads/${threadId}/messages`,
        { body },
      );
      return data.data;
    },
    onSuccess: () => {
      // Invalidation symétrique : le fil + la liste (pour la preview du
      // dernier message + le sort par récence) + le badge.
      void qc.invalidateQueries({
        queryKey: ["thread-messages", threadId],
        refetchType: "active",
      });
      void qc.invalidateQueries({ queryKey: ["threads"], refetchType: "active" });
      void qc.invalidateQueries({ queryKey: ["messaging-unread-total"] });
    },
  });
}

// === MARK READ ===
export function useMarkThreadRead(
  threadId: number,
): UseMutationResult<void, Error, void> {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.post(`/messaging/threads/${threadId}/read`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["messaging-unread-total"] });
    },
  });
}

// === MESSAGEABLE USERS (picker new) ===
export function useMessageableUsers(): UseQueryResult<MessageableUser[], Error> {
  return useQuery<MessageableUser[], Error>({
    queryKey: ["messageable-users"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageableUser[]>>(
        "/messaging/users",
      );
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
}

// === UNREAD TOTAL (badge tab) ===
export function useUnreadMessagesTotal(): UseQueryResult<number, Error> {
  return useQuery<number, Error>({
    queryKey: ["messaging-unread-total"],
    queryFn: async () => {
      // Endpoint renvoie `{ count: number }` (pas wrappé `data`).
      const { data } = await api.get<{ count: number }>("/messaging/unread-total");
      return data.count;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

// === Helpers UI ===

/**
 * Calcule le nom à afficher pour un thread :
 *  - direct (1-1) : nom de l'autre participant
 *  - group : `subject` ou liste des participants
 */
export function threadDisplayName(
  thread: MessageThread,
  participants: ThreadParticipant[] | undefined,
  currentUserId: number | null,
): string {
  if (thread.subject) return thread.subject;
  if (!participants || participants.length === 0) {
    return thread.created_by?.name ?? "Conversation";
  }
  if (thread.type === "direct") {
    const other = participants.find((p) => p.user_id !== currentUserId);
    return other?.user?.name ?? "Conversation";
  }
  // group : concaténer les noms (max 3).
  const names = participants
    .filter((p) => p.user_id !== currentUserId)
    .map((p) => p.user?.name ?? "?")
    .slice(0, 3);
  return names.join(", ") || "Groupe";
}

/** Avatar à afficher pour la card thread (= l'autre participant en direct). */
export function threadAvatarUrl(
  thread: MessageThread,
  participants: ThreadParticipant[] | undefined,
  currentUserId: number | null,
): string | null {
  if (!participants || participants.length === 0) return null;
  if (thread.type === "direct") {
    const other = participants.find((p) => p.user_id !== currentUserId);
    return other?.user?.avatar_url ?? null;
  }
  return null;
}

/** Format date relatif simple (réutilisable). */
export function formatThreadDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `il y a ${day} j`;
  return d.toLocaleDateString("fr-FR");
}
