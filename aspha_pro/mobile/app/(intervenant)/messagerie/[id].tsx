// Ecran : chat thread (messagerie interne).
//
// Layout (identique au pattern signalements/[id].tsx) :
//  ┌─────────────────────────────┐
//  │ Header thread (titre+meta)  │
//  ├─────────────────────────────┤
//  │ FlatList messages (auto-scroll bas) │
//  ├─────────────────────────────┤
//  │ Input + bouton envoyer      │  (Keyboard listener + paddingBottom)
//  └─────────────────────────────┘
//
// Gestion clavier custom (PAS de KeyboardAvoidingView) — cf. LRN
// signalements/[id].tsx : sur Android le composer disparait après ferm.
//
// Au mount → markRead automatique (POST /threads/{id}/read).
// Refetch messages toutes les 5 s (poll « live » sans WebSocket).
// Refetch threads liste après chaque envoi (preview + sort par récence).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import {
  formatThreadDate,
  threadDisplayName,
  useMarkThreadRead,
  useSendMessage,
  useThread,
  useThreadMessages,
  useThreads,
} from "@/hooks/use-intervenant-messaging";
import { useAuthStore } from "@/stores/auth";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { MessageThread, ThreadMessage, ThreadParticipant } from "@/types/api";

export default function ChatThreadScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const threadId = Number(params.id);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  // On lit le thread depuis le cache liste si possible pour avoir le nom dès
  // le 1er render (sans attendre le fetch détail).
  const threadsList = useThreads();
  const summary = useMemo<MessageThread | null>(() => {
    const all = threadsList.data ?? qc.getQueryData<MessageThread[]>(["threads"]) ?? [];
    return all.find((t) => t.id === threadId) ?? null;
  }, [threadsList.data, threadId, qc]);

  const { data: detail } = useThread(threadId);
  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
  } = useThreadMessages(threadId);

  const sendMut = useSendMessage(threadId);
  const markReadMut = useMarkThreadRead(threadId);

  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ThreadMessage>>(null);

  // Mark read au mount ET au focus (le ScreenScreen ne se ré-mount pas en
  // sub-route → on déclenche aussi quand messages.length change pour
  // dégrossir la dette).
  useEffect(() => {
    if (threadId != null && !isNaN(threadId)) {
      markReadMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      markReadMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length]);

  // Gestion clavier custom — cf. LRN signalements/[id].tsx (KeyboardAvoidingView
  // foireux sur Android Expo Go). paddingBottom dynamique sur le conteneur.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-scroll vers le bas à chaque nouveau message.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages?.length]);

  const headerTitle = useMemo(() => {
    if (!summary) return "Conversation";
    return threadDisplayName(summary, detail?.participants, me?.id ?? null);
  }, [summary, detail?.participants, me?.id]);

  const onSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    sendMut.mutate(
      { body },
      {
        onSuccess: () => {
          setDraft("");
        },
        onError: (e) => {
          Toast.show({
            type: "error",
            text1: "Envoi impossible",
            text2: e.message,
          });
        },
      },
    );
  }, [draft, sendMut]);

  const canSend = draft.trim().length > 0 && !sendMut.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerBackTitle: "Retour",
        }}
      />

      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
        {/* === Header info === */}
        {summary ? (
          <ThreadHeader summary={summary} participants={detail?.participants} myId={me?.id ?? null} />
        ) : null}

        {/* === Messages === */}
        {messagesLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messagesError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
            <Text style={styles.errorText}>{messagesError.message}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.flex}
            data={messages ?? []}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => (
              <MessageBubble msg={item} mineUserId={me?.id ?? null} />
            )}
            contentContainerStyle={styles.messagesContent}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyMessagesText}>
                  Démarre la conversation en envoyant un message.
                </Text>
              </View>
            }
          />
        )}

        {/* === Composer === */}
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Écris un message…"
            placeholderTextColor={colors.textSubtle}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={5000}
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          >
            {sendMut.isPending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ThreadHeader({
  summary,
  participants,
  myId,
}: {
  summary: MessageThread;
  participants: ThreadParticipant[] | undefined;
  myId: number | null;
}) {
  const name = threadDisplayName(summary, participants, myId);
  const sub = summary.type === "group"
    ? `${(participants?.length ?? 0)} participant(s)`
    : "Conversation directe";
  return (
    <View style={styles.header}>
      <View style={styles.headerAvatar}>
        <Ionicons
          name={summary.type === "group" ? "people-outline" : "person-outline"}
          size={20}
          color="#ffffff"
        />
      </View>
      <View style={styles.headerBody}>
        <Text style={styles.headerName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {sub} · {formatThreadDate(summary.created_at)}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({
  msg,
  mineUserId,
}: {
  msg: ThreadMessage;
  mineUserId: number | null;
}) {
  const mine = mineUserId != null && msg.sender_id === mineUserId;
  const stamp = msg.sent_at ?? msg.created_at ?? null;
  const time = stamp
    ? new Date(stamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        {!mine && msg.sender ? (
          <Text style={styles.bubbleSender}>{msg.sender.name}</Text>
        ) : null}
        <Text style={[styles.bubbleBody, mine && styles.bubbleBodyMine]}>{msg.body}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: typography.sm,
    color: colors.danger,
    textAlign: "center",
  },

  // Header info
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
  },
  headerSub: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },

  // Messages
  messagesContent: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyMessagesText: {
    marginTop: spacing.sm,
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: spacing.xs,
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowOther: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceMuted,
    borderBottomLeftRadius: 4,
  },
  bubbleSender: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: "700",
    marginBottom: 2,
  },
  bubbleBody: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 20,
  },
  bubbleBodyMine: {
    color: "#ffffff",
  },
  bubbleTime: {
    fontSize: 10,
    color: colors.textSubtle,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  bubbleTimeMine: {
    color: "rgba(255,255,255,0.75)",
  },

  // Composer
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
    color: colors.text,
    backgroundColor: colors.surface,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
