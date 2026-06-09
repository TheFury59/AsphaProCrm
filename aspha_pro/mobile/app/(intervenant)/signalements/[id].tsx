// Ecran : detail d'un signalement + fil de discussion (chat).
//
// Layout :
//  ┌─────────────────────────────┐
//  │ Header : sujet + meta       │  (sticky, non scrollable)
//  ├─────────────────────────────┤
//  │ FlatList des messages       │  (scroll, scrollTo end auto)
//  │  - Bulles gauche (autres)   │
//  │  - Bulles droite (moi)      │
//  ├─────────────────────────────┤
//  │ Input + bouton envoyer      │  (KeyboardAvoidingView)
//  └─────────────────────────────┘
//
// La liste des tickets est en cache : on lit le ticket dans le cache si
// possible pour eviter un fetch supplementaire (le sujet etc. y sont deja).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
  useIntervenantTickets,
  useSendTicketMessage,
  useTicketMessages,
  ticketStatusLabel,
  ticketStatusColor,
  ticketTypeLabel,
  ticketPriorityLabel,
  ticketPriorityColor,
  clientDisplayName,
} from "@/hooks/use-intervenant-tickets";
import { useAuthStore } from "@/stores/auth";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Ticket, TicketMessage } from "@/types/api";

export default function SignalementDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(params.id);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  // Lit le ticket depuis le cache liste ; sinon il sera null le temps que la
  // liste se charge (la liste est invalidée a chaque entree / pull-to-refresh).
  const ticketsList = useIntervenantTickets();
  const ticket = useMemo<Ticket | null>(() => {
    const all = ticketsList.data ?? qc.getQueryData<Ticket[]>(["intervenant-tickets"]) ?? [];
    return all.find((t) => t.id === ticketId) ?? null;
  }, [ticketsList.data, ticketId, qc]);

  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
  } = useTicketMessages(ticketId);

  const sendMut = useSendTicketMessage(ticketId);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<TicketMessage>>(null);

  // Auto-scroll vers le bas a chaque nouveau message recu.
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
        onSuccess: () => {
          setDraft("");
        },
        onError: (e) => {
          Alert.alert("Envoi impossible", e.message);
        },
      },
    );
  }, [draft, sendMut]);

  const canSend = draft.trim().length > 0 && !sendMut.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: ticket?.subject ?? "Signalement",
          headerBackTitle: "Retour",
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        // iOS : `padding` repousse le contenu au-dessus du clavier
        // Android : `height` redimensionne (combiné à `softwareKeyboardLayoutMode: resize`
        //           dans app.json) — sans ça le clavier mange le composer.
        // L'offset iOS compense la hauteur du header de la Stack (~44 + safe area).
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* === Header info ticket === */}
        {ticket ? <TicketHeader ticket={ticket} /> : null}

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
            data={messages ?? []}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => <MessageBubble msg={item} mineUserId={me?.id ?? null} />}
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

        {/* === Input === */}
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
      </KeyboardAvoidingView>
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
        <View style={[styles.priorityBadge, { backgroundColor: ticketPriorityColor(ticket.priority) }]}>
          <Text style={styles.statusBadgeText}>{ticketPriorityLabel(ticket.priority)}</Text>
        </View>
      </View>
      <Text style={styles.headerClient} numberOfLines={1}>
        {clientDisplayName(ticket.client)} · {ticketTypeLabel(ticket.type)}
      </Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerTopRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
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
  headerClient: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: "600",
  },
  headerBody: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
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
