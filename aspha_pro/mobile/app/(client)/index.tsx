// Ecran d'accueil client — overview KPI + raccourcis vers les tabs.
//
// 3 KPI cards :
//   - Devis a valider (count quotes status=sent)
//   - Factures impayees (count via isInvoiceUnpaid)
//   - Demandes ouvertes (count tickets status != closed)
//
// Pas de section "Prochain RDV" en V1 (endpoint dedie a venir).
// Pull-to-refresh sur le ScrollView invalide les 4 queries.

import React, { useCallback, useMemo } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useClientProfile, getCompanyInitials } from "@/hooks/use-client-profile";
import { useClientQuotes } from "@/hooks/use-client-quotes";
import { useClientInvoices, isInvoiceUnpaid } from "@/hooks/use-client-invoices";
import { useClientTickets } from "@/hooks/use-client-tickets";
import { useAuthStore } from "@/stores/auth";
import { colors, radius, spacing, typography } from "@/lib/theme";

export default function ClientHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const profile = useClientProfile();
  const quotes = useClientQuotes();
  const invoices = useClientInvoices();
  const tickets = useClientTickets();

  const isRefreshing =
    profile.isRefetching ||
    quotes.isRefetching ||
    invoices.isRefetching ||
    tickets.isRefetching;

  const onRefresh = useCallback(() => {
    void profile.refetch();
    void quotes.refetch();
    void invoices.refetch();
    void tickets.refetch();
  }, [profile, quotes, invoices, tickets]);

  const stats = useMemo(() => {
    const quotesToValidate = (quotes.data ?? []).filter((q) => q.status === "sent").length;
    const unpaidInvoices = (invoices.data ?? []).filter((i) => isInvoiceUnpaid(i)).length;
    const openTickets = (tickets.data ?? []).filter((t) => t.status !== "closed").length;
    return { quotesToValidate, unpaidInvoices, openTickets };
  }, [quotes.data, invoices.data, tickets.data]);

  const company = profile.data?.company ?? null;
  const logoUrl = company?.logo_url ?? null;
  const initials = getCompanyInitials(profile.data, user?.name ?? "?");
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return "Bonsoir";
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* === HEADER === */}
        <View style={styles.header}>
          <View style={styles.headerLogoWrap}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.headerLogo} />
            ) : (
              <View style={[styles.headerLogo, styles.headerLogoFallback]}>
                <Text style={styles.headerLogoInitials}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerGreeting}>{greeting},</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {company?.company_name ?? user?.name ?? "—"}
            </Text>
            {profile.data?.code ? (
              <Text style={styles.headerCode}>Code client : {profile.data.code}</Text>
            ) : null}
          </View>
        </View>

        {/* === KPI CARDS === */}
        <View style={styles.kpiGrid}>
          <KpiCard
            icon="document-text-outline"
            label="Devis à valider"
            value={stats.quotesToValidate}
            color={colors.warning}
            onPress={() => router.push("/(client)/devis" as never)}
          />
          <KpiCard
            icon="receipt-outline"
            label="Factures impayées"
            value={stats.unpaidInvoices}
            color={colors.danger}
            onPress={() => router.push("/(client)/factures" as never)}
          />
          <KpiCard
            icon="chatbubbles-outline"
            label="Demandes ouvertes"
            value={stats.openTickets}
            color={colors.info}
            onPress={() => router.push("/(client)/demandes" as never)}
          />
        </View>

        {/* === QUICK ACTIONS === */}
        <Text style={styles.sectionTitle}>Accès rapide</Text>
        <View style={styles.shortcuts}>
          <Shortcut
            icon="document-text-outline"
            label="Mes devis"
            onPress={() => router.push("/(client)/devis" as never)}
          />
          <Shortcut
            icon="receipt-outline"
            label="Mes factures"
            onPress={() => router.push("/(client)/factures" as never)}
          />
          <Shortcut
            icon="chatbubbles-outline"
            label="Mes demandes"
            onPress={() => router.push("/(client)/demandes" as never)}
          />
          <Shortcut
            icon="add-circle-outline"
            label="Nouvelle demande"
            onPress={() => router.push("/(client)/demandes/new" as never)}
            accent
          />
          <Shortcut
            icon="person-outline"
            label="Mon profil"
            onPress={() => router.push("/(client)/profil" as never)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.kpiCard, pressed && styles.cardPressed]}
    >
      <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Pressable>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shortcut,
        accent && styles.shortcutAccent,
        pressed && styles.cardPressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={accent ? "#ffffff" : colors.text}
        style={styles.shortcutIcon}
      />
      <Text style={[styles.shortcutLabel, accent && styles.shortcutLabelAccent]}>{label}</Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={accent ? "#ffffff" : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerLogoWrap: {},
  headerLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  headerLogoFallback: {
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogoInitials: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  headerTextBlock: { flex: 1, gap: 2 },
  headerGreeting: { fontSize: typography.sm, color: colors.textMuted },
  headerName: { fontSize: typography.xl, fontWeight: "700", color: colors.text },
  headerCode: { fontSize: typography.xs, color: colors.textSubtle },

  // KPI grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  kpiCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardPressed: { opacity: 0.7 },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  kpiValue: {
    fontSize: typography.xxl,
    fontWeight: "700",
    lineHeight: 32,
  },
  kpiLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: "600",
  },

  // Shortcuts
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  shortcuts: { gap: spacing.sm },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  shortcutAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  shortcutIcon: {},
  shortcutLabel: { flex: 1, fontSize: typography.base, fontWeight: "600", color: colors.text },
  shortcutLabelAccent: { color: "#ffffff" },
});
