// Ecran liste des signalements / tickets cote intervenant.
// - Pull to refresh
// - FAB en bas-droite -> /signalements/new
// - Tap sur une carte -> /signalements/[id] (fil de discussion)
// - Empty state guide vers la creation
//
// On differencie visuellement par status (couleur de pastille gauche) et
// priorite (badge). Le type ticket est affiche en texte secondaire.

import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  useIntervenantTickets,
  ticketTypeLabel,
  ticketStatusLabel,
  ticketStatusColor,
  ticketPriorityLabel,
  ticketPriorityColor,
  clientDisplayName,
} from "@/hooks/use-intervenant-tickets";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Ticket } from "@/types/api";

export default function SignalementsListScreen() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch, error } = useIntervenantTickets();

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onPressTicket = useCallback(
    (t: Ticket) => {
      router.push(`/(intervenant)/signalements/${t.id}` as never);
    },
    [router],
  );

  const onPressNew = useCallback(() => {
    router.push("/(intervenant)/signalements/new" as never);
  }, [router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>Impossible de charger les signalements</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const tickets = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <FlatList
        data={tickets}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={tickets.length === 0 ? styles.emptyWrap : styles.listContent}
        renderItem={({ item }) => <TicketCard ticket={item} onPress={() => onPressTicket(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState onPressNew={onPressNew} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />

      <Pressable
        onPress={onPressNew}
        accessibilityRole="button"
        accessibilityLabel="Créer un signalement"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}

function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const statusColor = ticketStatusColor(ticket.status);
  const priorityColor = ticketPriorityColor(ticket.priority);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardSubject} numberOfLines={2}>
            {ticket.subject}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
            <Text style={styles.priorityBadgeText}>{ticketPriorityLabel(ticket.priority)}</Text>
          </View>
        </View>
        <Text style={styles.cardClient} numberOfLines={1}>
          {clientDisplayName(ticket.client)}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>
            {ticketTypeLabel(ticket.type)} · {ticketStatusLabel(ticket.status)}
          </Text>
          <Text style={styles.cardDate}>{formatRelative(ticket.created_at)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function EmptyState({ onPressNew }: { onPressNew: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="warning-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Aucun signalement</Text>
      <Text style={styles.emptyBody}>
        Tu n'as encore créé aucun signalement et personne ne t'a affecté à un ticket.
      </Text>
      <Pressable onPress={onPressNew} style={styles.emptyCta}>
        <Ionicons name="add" size={18} color="#ffffff" />
        <Text style={styles.emptyCtaText}>Créer un signalement</Text>
      </Pressable>
    </View>
  );
}

// Format date relatif simple. Pour V1 on reste sur les bornes 1/60/24/7 ;
// au-dela on retombe sur jj/mm/yyyy. Pas de lib externe.
function formatRelative(iso: string): string {
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    textAlign: "center",
  },
  errorBody: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl + 32, // espace pour le FAB
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyBody: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  emptyCtaText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: typography.md,
  },
  separator: {
    height: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardPressed: {
    opacity: 0.65,
  },
  statusDot: {
    width: 8,
    height: 56,
    borderRadius: 4,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardSubject: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  priorityBadgeText: {
    color: "#ffffff",
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardClient: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  cardMeta: {
    fontSize: typography.xs,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  cardDate: {
    fontSize: typography.xs,
    color: colors.textSubtle,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
