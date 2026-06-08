// Ecran profil client — bare minimum P0-1 avec logout.

import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/components/ui/Toast";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

export default function ProfilClientScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("[profil-client] logout failed", err);
      showToast("Deconnexion partielle (token local efface).", "info");
    }
  };

  return (
    <Screen scroll>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        <Text style={styles.role}>Client</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Profil complet (coordonnees, mode de paiement, notifs) — sprint P1.
        </Text>
      </View>

      <Button label="Se deconnecter" onPress={handleLogout} variant="danger" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  name: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
  },
  email: {
    fontSize: typography.md,
    color: colors.textMuted,
  },
  role: {
    marginTop: spacing.sm,
    fontSize: typography.xs,
    fontWeight: "600",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  placeholder: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xl,
  },
  placeholderText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
