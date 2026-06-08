// Ecran planning intervenant.
// - SectionList groupant les events par jour
// - Pull-to-refresh (RefreshControl)
// - Etats : loading skeleton / error / empty / liste
// - Bouton « Aujourd'hui » : scroll au premier item du jour courant
// - Bouton refresh (header) : refetch()
// - Clic carte -> /(intervenant)/rdv/[id]
//
// Cache react-query partage avec rdv/[id].tsx via buildPlanningQueryKey.

import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  type SectionListData,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  eventIdToString,
  useIntervenantPlanning,
  type IntervenantEvent,
} from "@/hooks/use-intervenant-planning";
import {
  addDays,
  formatDateShort,
  formatRange,
  formatTime,
  parseLocalNaive,
  startOfToday,
  toDateKey,
} from "@/lib/date";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";

type Section = {
  key: string; // YYYY-MM-DD
  title: string;
  data: IntervenantEvent[];
};

// Couleurs de statut.
function statusColor(event: IntervenantEvent): string {
  if (event.status === "realisee") {
    return event.checkin?.checkin_time ? "#22c55e" : "#a855f7";
  }
  switch (event.status) {
    case "annulee":
      return "#ef4444";
    case "a_pourvoir":
      return "#f97316";
    case "planifiee":
      return "#3b82f6";
    case "draft":
    case "terminated":
      return "#94a3b8";
  }
}

function statusLabel(event: IntervenantEvent): string {
  if (event.status === "realisee") {
    return event.checkin?.checkin_time ? "Terminé" : "Terminé (non badgé)";
  }
  switch (event.status) {
    case "annulee":
      return "Annulé";
    case "a_pourvoir":
      return "À pourvoir";
    case "planifiee":
      return "Planifié";
    case "draft":
      return "Brouillon";
    case "terminated":
      return "Clos";
  }
}

function clientDisplayName(client: IntervenantEvent["client"]): string {
  if (client.company_name && client.company_name.trim().length > 0) {
    return client.company_name;
  }
  const first = client.first_name?.trim() ?? "";
  const last = client.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : `Client ${client.code}`;
}

function shortAddress(address: IntervenantEvent["client"]["address"]): string | null {
  if (!address) return null;
  const street = address.address?.trim() ?? "";
  const city = `${address.postal_code} ${address.city}`.trim();
  return [street, city].filter((s) => s.length > 0).join(" · ");
}

// Regroupe les events par jour (cle YYYY-MM-DD local), tri chronologique.
function groupByDay(events: IntervenantEvent[]): Section[] {
  const buckets = new Map<string, IntervenantEvent[]>();
  for (const ev of events) {
    const start = parseLocalNaive(ev.start_datetime);
    if (!start) continue;
    const key = toDateKey(start);
    const list = buckets.get(key);
    if (list) {
      list.push(ev);
    } else {
      buckets.set(key, [ev]);
    }
  }
  const sortedKeys = Array.from(buckets.keys()).sort();
  const sections: Section[] = [];
  for (const key of sortedKeys) {
    const data = (buckets.get(key) ?? []).slice().sort((a, b) => {
      return a.start_datetime.localeCompare(b.start_datetime);
    });
    // Pour le titre, on parse le premier event du bucket (ils sont tous le meme jour).
    const first = data[0];
    if (!first) continue;
    const startDate = parseLocalNaive(first.start_datetime);
    if (!startDate) continue;
    sections.push({ key, title: formatDateShort(startDate), data });
  }
  return sections;
}

export default function PlanningScreen() {
  const router = useRouter();
  const sectionListRef = useRef<SectionList<IntervenantEvent, Section>>(null);

  // Plage par defaut : aujourd'hui -> +7 jours.
  const range = useMemo(() => {
    const from = startOfToday();
    const to = addDays(from, 7);
    return { from, to };
  }, []);

  const query = useIntervenantPlanning(range.from, range.to);
  const events = query.data ?? [];
  const sections = useMemo(() => groupByDay(events), [events]);

  const todayKey = toDateKey(startOfToday());
  const todaySectionIndex = sections.findIndex((s) => s.key === todayKey);

  const onPressEvent = useCallback(
    (event: IntervenantEvent) => {
      router.push({
        pathname: "/(intervenant)/rdv/[id]",
        params: { id: eventIdToString(event.id) },
      } as never);
    },
    [router],
  );

  const onPressToday = useCallback(() => {
    if (sections.length === 0) return;
    if (todaySectionIndex < 0) {
      showToast("Aucun RDV aujourd'hui", "info");
      return;
    }
    sectionListRef.current?.scrollToLocation({
      sectionIndex: todaySectionIndex,
      itemIndex: 0,
      animated: true,
      viewOffset: 0,
    });
  }, [sections, todaySectionIndex]);

  const onRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: IntervenantEvent }) => (
      <EventCard event={item} onPress={() => onPressEvent(item)} />
    ),
    [onPressEvent],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<IntervenantEvent, Section> }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>
          {section.data.length} RDV{section.data.length > 1 ? "s" : ""}
        </Text>
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: IntervenantEvent) => eventIdToString(item.id),
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Mon planning</Text>
          <Text style={styles.subtitle}>Semaine {formatRange(range.from, range.to)}</Text>
        </View>
        <View style={styles.headerActions}>
          <HeaderIconButton
            icon="today-outline"
            label="Aujourd'hui"
            onPress={onPressToday}
          />
          <HeaderIconButton
            icon="refresh-outline"
            label="Rafraichir"
            onPress={onRefresh}
            spinning={query.isFetching && !query.isRefetching}
          />
        </View>
      </View>

      {query.isLoading ? (
        <PlanningSkeleton />
      ) : query.isError ? (
        <ErrorState message={query.error?.message ?? "Erreur reseau"} onRetry={onRefresh} />
      ) : sections.length === 0 ? (
        <EmptyState onRefresh={onRefresh} />
      ) : (
        <SectionList<IntervenantEvent, Section>
          ref={sectionListRef}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onScrollToIndexFailed={(info) => {
            // Fallback en cas de mesure incomplete : retente apres un cycle.
            setTimeout(() => {
              sectionListRef.current?.scrollToLocation({
                sectionIndex: info.index,
                itemIndex: 0,
                animated: true,
              });
            }, 100);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// Sous-composants
// ============================================================

type HeaderIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  spinning?: boolean;
};

function HeaderIconButton({ icon, label, onPress, spinning }: HeaderIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
      hitSlop={8}
    >
      {spinning ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={22} color={colors.primary} />
      )}
    </Pressable>
  );
}

type EventCardProps = {
  event: IntervenantEvent;
  onPress: () => void;
};

function EventCard({ event, onPress }: EventCardProps) {
  const start = parseLocalNaive(event.start_datetime);
  const end = parseLocalNaive(event.end_datetime);
  const timeLabel = start && end ? `${formatTime(start)} - ${formatTime(end)}` : "—";
  const color = statusColor(event);
  const label = statusLabel(event);
  const name = clientDisplayName(event.client);
  const addr = shortAddress(event.client.address);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.time}>{timeLabel}</Text>
          <Text style={styles.client} numberOfLines={1}>
            {name}
          </Text>
          {addr ? (
            <Text style={styles.address} numberOfLines={2}>
              {addr}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={styles.statusBadgeText}>{label}</Text>
          </View>
          {event.has_keys ? (
            <View style={styles.keyBadge}>
              <Text style={styles.keyBadgeText}>🔑 {event.keys_count || ""}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function PlanningSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonGroup}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
        </View>
      ))}
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Impossible de charger le planning</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      <View style={styles.retryWrap}>
        <Button label="Réessayer" onPress={onRetry} variant="outline" fullWidth={false} />
      </View>
    </View>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.centered}>
      <Ionicons name="calendar-clear-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Aucun RDV planifié sur cette période</Text>
      <Text style={styles.emptyMessage}>Tire vers le bas pour rafraichir.</Text>
      <View style={styles.retryWrap}>
        <Button label="Rafraichir" onPress={onRefresh} variant="outline" fullWidth={false} />
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  headerBtnPressed: {
    opacity: 0.6,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    textTransform: "capitalize",
  },
  sectionCount: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: "500",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardLeft: {
    flex: 1,
    paddingRight: spacing.md,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  time: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  client: {
    fontSize: typography.base,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  address: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    color: colors.textInverse,
    fontSize: typography.xs,
    fontWeight: "700",
  },
  keyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.warning,
  },
  keyBadgeText: {
    color: colors.textInverse,
    fontSize: typography.xs,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.lg,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  emptyMessage: {
    marginTop: spacing.xs,
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  retryWrap: {
    marginTop: spacing.lg,
  },
  skeletonContainer: {
    padding: spacing.lg,
  },
  skeletonGroup: {
    marginBottom: spacing.xl,
  },
  skeletonHeader: {
    width: 140,
    height: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  skeletonCard: {
    height: 84,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
});
