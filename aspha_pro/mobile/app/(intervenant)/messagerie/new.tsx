// Ecran : nouvelle conversation 1-1 (V1 mobile).
//
// Le mobile V1 ne gère QUE des conversations directes (un seul user dans
// la liste participant_ids). Pour des groupes / participants multiples,
// passer par le web.
//
// Flow :
//  1. Liste des users invitables (GET /messaging/users)
//  2. Tap sur un user → POST /messaging/threads avec subject = nom du user
//  3. Sur succès : router.replace(`/messagerie/${id}`)

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import {
  useCreateThread,
  useMessageableUsers,
} from "@/hooks/use-intervenant-messaging";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { MessageableUser } from "@/types/api";

export default function NewThreadScreen() {
  const router = useRouter();
  const { data, isLoading, error } = useMessageableUsers();
  const createMut = useCreateThread();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const onPickUser = useCallback(
    (u: MessageableUser) => {
      if (createMut.isPending) return;
      createMut.mutate(
        {
          participant_ids: [u.id],
          // Subject = nom de l'autre user — sert d'affichage dans la liste
          // (la /messaging/threads ne renvoie pas les participants).
          subject: u.name,
          type: "direct",
        },
        {
          onSuccess: ({ id }) => {
            // replace (pas push) pour qu'un back depuis le chat ramène à la
            // liste, pas à l'écran de sélection.
            router.replace(`/(intervenant)/messagerie/${id}` as never);
          },
          onError: (e) => {
            Toast.show({
              type: "error",
              text1: "Création impossible",
              text2: e.message,
            });
          },
        },
      );
    },
    [createMut, router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Nouvelle conversation" }} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un collègue ou un admin…"
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyWrap : styles.listContent
          }
          renderItem={({ item }) => (
            <UserRow
              user={item}
              disabled={createMut.isPending}
              onPress={() => onPickUser(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun utilisateur</Text>
              <Text style={styles.emptyBody}>
                {search
                  ? "Aucun résultat pour cette recherche."
                  : "Personne n'est encore disponible pour démarrer une conversation."}
              </Text>
            </View>
          }
        />
      )}

      {createMut.isPending ? (
        <View style={styles.creatingOverlay}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.creatingText}>Création de la conversation…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function UserRow({
  user,
  disabled,
  onPress,
}: {
  user: MessageableUser;
  disabled: boolean;
  onPress: () => void;
}) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.userRow,
        pressed && styles.userRowPressed,
        disabled && styles.userRowDisabled,
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || "?"}</Text>
      </View>
      <View style={styles.userBody}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.userMeta} numberOfLines={1}>
          {roleLabel(user.role)} · {user.email}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function roleLabel(role: string | null): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "admin":
      return "Admin";
    case "intervenant":
      return "Intervenant";
    case "client":
      return "Client";
    default:
      return role ?? "—";
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
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
  listContent: {
    padding: spacing.lg,
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
  separator: {
    height: spacing.sm,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userRowPressed: {
    opacity: 0.65,
  },
  userRowDisabled: {
    opacity: 0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: typography.md,
  },
  userBody: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
  },
  userMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  creatingOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.overlay,
  },
  creatingText: {
    color: "#ffffff",
    fontSize: typography.sm,
    fontWeight: "600",
  },
});
