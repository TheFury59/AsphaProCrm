// Ecran : detail d'une demande (ticket) + fil de discussion cote client.
//
// Identique au pattern signalements intervenant :
//  - Header info (sujet, statut, priorite, body)
//  - FlatList des messages (bulles gauche/droite selon sender_id == me.id)
//  - Composer (TextInput + send) avec gestion clavier custom (paddingBottom
//    dynamique sur Keyboard listener — pas de KeyboardAvoidingView, cf. LRN
//    intervenant : sinon composer mange par clavier sur Android Expo Go).
//
// Polling 5s sur le fil de messages (cf. useClientTicketMessages).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import {
  useClientTickets,
  useClientTicketMessages,
  useSendClientTicketMessage,
} from "@/hooks/use-client-tickets";
import {
  ticketStatusLabel,
  ticketStatusColor,
  ticketTypeLabel,
  ticketPriorityLabel,
  ticketPriorityColor,
} from "@/hooks/use-intervenant-tickets";
import { useAuthStore } from "@/stores/auth";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Ticket, TicketMessage } from "@/types/api";

export default function DemandeDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(params.id);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const ticketsList = useClientTickets();
  const ticket = useMemo<Ticket | null>(() => {
    const all = ticketsList.data ?? qc.getQueryData<Ticket[]>(["client-tickets"]) ?? [];
    return all.find((t) => t.id === ticketId) ?? null;
  }, [ticketsList.data, ticketId, qc]);

  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
  } = useClientTicketMessages(ticketId);

  const sendMut = useSendClientTicketMessage(ticketId);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<TicketMessage>>(null);

  // Gestion clavier custom (cf. signalements intervenant LRN).
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

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages?.length]);

  const onSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    sendMut.mutate(
      { body },
      {
        onSuccess: () => setDraft(""),
        onError: (e) => Alert.alert("Envoi impossible", e.message),
      },
    );
  }, [draft, sendMut]);

  const canSend = draft.trim().length > 0 && !sendMut.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: ticket?.subject ?? "Demande",
          headerBackTitle: "Retour",
        }}
      />

      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
        {ticket ? <TicketHeader ticket={ticket} /> : null}

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
            renderItem={({ item }) => <MessageBubble msg={item} mineUserId={me?.id ?? null} />}
            contentContainerStyle={styles.messagesContent}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyMessagesText}>
                  Aucun message pour l'instant. Écrivez ci-dessous pour démarrer l'échange avec Aspha.
                </Text>
              </View>
            }
          />
        )}

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

function TicketHeader({ ticket }: { ticket: Ticket }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View style={[styles.statusBadge, { backgroundColor: ticketStatusColor(ticket.status) }]}>
          <Text style={styles.statusBadgeText}>{ticketStatusLabel(ticket.status)}</Text>
        </View>
        <View
          style={[styles.priorityBadge, { backgroundColor: ticketPriorityColor(ticket.priority) }]}
        >
          <Text style={styles.statusBadgeText}>{ticketPriorityLabel(ticket.priority)}</Text>
        </View>
      </View>
      <Text style={styles.headerType}>{ticketTypeLabel(ticket.type)}</Text>
      {ticket.body ? <Text style={styles.headerBody}>{ticket.body}</Text> : null}
    </View>
  );
}

function MessageBubble({
  msg,
  mineUserId,
}: {
  msg: TicketMessage;
  mineUserId: number | null;
}) {
  const mine = mineUserId != null && msg.sender_id === mineUserId;
  const time = new Date(msg.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: {
    marginTop: spacing.sm,
    fontSize: typography.sm,
    color: colors.danger,
    textAlign: "center",
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerTopRow: { flexDirection: "row", gap: spacing.sm },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    color: "#ffffff",
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  headerType: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: "600",
  },
  headerBody: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
  },

  messagesContent: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyMessagesText: {
    marginTop: spacing.sm,
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  bubbleRow: { flexDirection: "row", marginVertical: spacing.xs },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
  bubbleSender: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: "700",
    marginBottom: 2,
  },
  bubbleBody: { fontSize: typography.base, color: colors.text, lineHeight: 20 },
  bubbleBodyMine: { color: "#ffffff" },
  bubbleTime: { fontSize: 10, color: colors.textSubtle, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },

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
  sendBtnDisabled: { opacity: 0.5 },
});
