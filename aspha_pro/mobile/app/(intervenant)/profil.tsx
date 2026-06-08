// Ecran profil intervenant — fonctionnel des P0-1 pour exposer le logout.
// Le reste (avatar, infos contractuelles, notif prefs) viendra dans les sprints suivants.

import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/components/ui/Toast";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

export default function ProfilIntervenantScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("[profil] logout failed", err);
      showToast("Deconnexion partielle (token local efface).", "info");
    }
  };

  return (
    <Screen scroll>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        {user?.role ? <Text style={styles.role}>{labelForRole(user.role)}</Text> : null}
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Le reste du profil arrive dans les sprints suivants (parametres notifs, securite bio,
          historique).
        </Text>
      </View>

      <Button label="Se deconnecter" onPress={handleLogout} variant="danger" />
    </Screen>
  );
}

function labelForRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super administrateur";
    case "admin":
      return "Administrateur";
    case "intervenant":
      return "Intervenant terrain";
    case "client":
      return "Client";
    default:
      return role;
  }
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
    color: colors.primary,
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
