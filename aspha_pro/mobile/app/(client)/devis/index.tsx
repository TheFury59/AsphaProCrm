// Ecran : liste des devis du client.
//
// - Pull to refresh
// - Tap sur une carte -> /(client)/devis/[id] (detail + actions Valider/Refuser)
// - Statuts visuels par couleur de pastille gauche
// - Empty state simple

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
  useClientQuotes,
  quoteStatusLabel,
  quoteStatusColor,
  formatMoney,
} from "@/hooks/use-client-quotes";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Quote } from "@/types/api";

export default function DevisListScreen() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch, error } = useClientQuotes();

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onPressQuote = useCallback(
    (q: Quote) => {
      router.push(`/(client)/devis/${q.id}` as never);
    },
    [router],
  );

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
          <Text style={styles.errorTitle}>Impossible de charger les devis</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const quotes = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <FlatList
        data={quotes}
        keyExtractor={(q) => String(q.id)}
        contentContainerStyle={quotes.length === 0 ? styles.emptyWrap : styles.listContent}
        renderItem={({ item }) => <QuoteCard quote={item} onPress={() => onPressQuote(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />
    </SafeAreaView>
  );
}

function QuoteCard({ quote, onPress }: { quote: Quote; onPress: () => void }) {
  const color = quoteStatusColor(quote.status);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardRef} numberOfLines={1}>
            {quote.reference ?? `Devis #${quote.id}`}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={styles.statusBadgeText}>{quoteStatusLabel(quote.status)}</Text>
          </View>
        </View>
        {quote.comment ? (
          <Text style={styles.cardComment} numberOfLines={1}>
            {quote.comment}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardAmount}>{formatMoney(quote.total)}</Text>
          <Text style={styles.cardDate}>{formatDate(quote.quote_date)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Aucun devis</Text>
      <Text style={styles.emptyBody}>
        Quand un commercial Aspha vous enverra un devis, il apparaîtra ici.
      </Text>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR");
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  retryBtnText: { color: "#ffffff", fontWeight: "700" },

  listContent: { padding: spacing.lg },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
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

  separator: { height: spacing.sm },
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
  cardPressed: { opacity: 0.65 },
  statusDot: { width: 8, height: 56, borderRadius: 4 },
  cardBody: { flex: 1, gap: spacing.xs },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardRef: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
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
  cardComment: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  cardAmount: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
  },
  cardDate: {
    fontSize: typography.xs,
    color: colors.textSubtle,
  },
});
