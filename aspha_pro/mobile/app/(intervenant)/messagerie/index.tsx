// Ecran liste des conversations (messagerie interne).
//
// Layout :
//  ┌─────────────────────────────┐
//  │ Liste des threads (FlatList)│
//  │  [avatar] Nom               │ ← badge unread si > 0
//  │           dernier message…  │
//  │           il y a 5 min      │
//  └─────────────────────────────┘
//  FAB → /messagerie/new
//
// On affiche l'avatar de l'autre participant en direct (1-1). Pour un group,
// fallback sur une icône. Le sujet du thread sert de fallback si on n'a pas
// les participants encore chargés (la liste backend ne renvoie pas la liste
// des participants — il faudrait charger /messaging/threads/{id} pour ça).
// V1 : on affiche `subject` s'il existe, sinon le nom du créateur.

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
  formatThreadDate,
  useThreads,
} from "@/hooks/use-intervenant-messaging";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { MessageThread } from "@/types/api";

export default function MessagerieListScreen() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch, error } = useThreads();

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onPressThread = useCallback(
    (t: MessageThread) => {
      router.push(`/(intervenant)/messagerie/${t.id}` as never);
    },
    [router],
  );

  const onPressNew = useCallback(() => {
    router.push("/(intervenant)/messagerie/new" as never);
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
          <Text style={styles.errorTitle}>Impossible de charger les conversations</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const threads = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <FlatList
        data={threads}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={threads.length === 0 ? styles.emptyWrap : styles.listContent}
        renderItem={({ item }) => (
          <ThreadCard thread={item} onPress={() => onPressThread(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState onPressNew={onPressNew} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />

      <Pressable
        onPress={onPressNew}
        accessibilityRole="button"
        accessibilityLabel="Nouvelle conversation"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="create-outline" size={24} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}

function ThreadCard({
  thread,
  onPress,
}: {
  thread: MessageThread;
  onPress: () => void;
}) {
  // Sans liste de participants (la /messaging/threads ne les renvoie pas),
  // on s'appuie sur `subject` ou le nom du créateur. C'est cohérent avec le
  // pattern web actuel — chaque thread 1-1 a en pratique un `subject` rempli
  // par la conv créée depuis l'app.
  const name = thread.subject ?? thread.created_by?.name ?? "Conversation";
  const lastBody = thread.last_message?.body ?? "Aucun message";
  const lastDate = formatThreadDate(thread.last_message?.sent_at ?? thread.created_at);
  const hasUnread = thread.unread_count > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <ThreadAvatar name={name} thread={thread} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardName, hasUnread && styles.cardNameUnread]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.cardDate, hasUnread && styles.cardDateUnread]}>{lastDate}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text
            style={[styles.cardPreview, hasUnread && styles.cardPreviewUnread]}
            numberOfLines={1}
          >
            {lastBody}
          </Text>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {thread.unread_count > 99 ? "99+" : thread.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ThreadAvatar({ name, thread }: { name: string; thread: MessageThread }) {
  // Pour un group on garde un icône groupe. Pour direct on dérive les
  // initiales du nom (faute d'avatar dans la liste threads).
  if (thread.type === "group") {
    return (
      <View style={[styles.avatar, styles.avatarGroup]}>
        <Ionicons name="people-outline" size={20} color="#ffffff" />
      </View>
    );
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials || "?"}</Text>
    </View>
  );
}

function EmptyState({ onPressNew }: { onPressNew: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Aucune conversation</Text>
      <Text style={styles.emptyBody}>
        Discute avec l'agence et tes collègues. Crée une conversation pour
        commencer.
      </Text>
      <Pressable onPress={onPressNew} style={styles.emptyCta}>
        <Ionicons name="create-outline" size={18} color="#ffffff" />
        <Text style={styles.emptyCtaText}>Démarrer une discussion</Text>
      </Pressable>
    </View>
  );
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
    paddingBottom: spacing.xxxl + 32,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGroup: {
    backgroundColor: colors.accent,
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: typography.md,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: "600",
    color: colors.text,
  },
  cardNameUnread: {
    fontWeight: "700",
  },
  cardDate: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  cardDateUnread: {
    color: colors.primary,
    fontWeight: "700",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardPreview: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  cardPreviewUnread: {
    color: colors.text,
    fontWeight: "600",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: typography.xs,
    fontWeight: "700",
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
