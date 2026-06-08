// Ecran de changement de mot de passe force (must_change_password = true).
// Reutilise l'endpoint web POST /auth/me (cf. frontend) qui accepte
// {current_password, password, password_confirmation} et flippe must_change_password
// a false. Une fois OK, on refetch /me et le root layout redirige vers le bon home.

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/components/ui/Toast";
import { api, apiErrorMessage } from "@/lib/api";
import { colors, spacing, typography } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

export default function ChangePasswordScreen() {
  const logout = useAuthStore((s) => s.logout);
  const refetchMe = useAuthStore((s) => s.refetchMe);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validation au clic — pas de disabled.
    if (!current) {
      showToast("Saisis ton mot de passe actuel.", "error");
      return;
    }
    if (!next) {
      showToast("Saisis un nouveau mot de passe.", "error");
      return;
    }
    if (next.length < 8) {
      showToast("8 caracteres minimum.", "error", "Mot de passe trop court");
      return;
    }
    if (next !== confirm) {
      showToast("Les mots de passe ne correspondent pas.", "error");
      return;
    }
    if (next === current) {
      showToast("Le nouveau mot de passe doit etre different.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/me", {
        current_password: current,
        password: next,
        password_confirmation: confirm,
      });
      await refetchMe();
      showToast("Mot de passe mis a jour.", "success");
      // Le root layout va detecter must_change_password = false et rediriger.
    } catch (err) {
      console.error("[change-password] submit failed", err);
      showToast(apiErrorMessage(err, "Impossible de changer le mot de passe"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    void logout();
  };

  return (
    <Screen scroll keyboardAware>
      <View style={styles.header}>
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.subtitle}>
          Pour des raisons de securite, tu dois changer ton mot de passe avant d'acceder a l'app.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Mot de passe actuel"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
        <Input
          label="Nouveau mot de passe"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          helper="8 caracteres minimum"
        />
        <Input
          label="Confirmer le nouveau mot de passe"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
        />

        <View style={styles.spacer} />

        <Button label="Mettre a jour" onPress={handleSubmit} loading={submitting} />
        <Button label="Se deconnecter" onPress={handleLogout} variant="ghost" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
  form: {
    gap: spacing.lg,
  },
  spacer: {
    height: spacing.sm,
  },
});
