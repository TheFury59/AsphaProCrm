import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/components/ui/Toast";
import { api, apiErrorMessage } from "@/lib/api";
import { colors, spacing, typography } from "@/lib/theme";

/**
 * Écran « Mot de passe oublié » côté mobile.
 *
 * - L'utilisateur saisit son email.
 * - On POST `/forgot-password` au backend → email envoyé avec lien
 *   `<frontend>/reset-password?token=X&email=Y`.
 * - Comme le reset se fait via le **frontend web** (pas un deep-link mobile
 *   pour V1), on affiche un écran de confirmation : « regarde tes mails,
 *   clique le lien, change ton mdp depuis ton navigateur, puis reviens
 *   te connecter dans l'app ».
 * - Backend renvoie 200 OK même si l'email n'existe pas (anti-enum) →
 *   on affiche la confirmation dans tous les cas.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showToast("Saisis ton email.", "error", "Email manquant");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/forgot-password", { email: trimmedEmail });
      setSent(true);
    } catch (err) {
      const message = apiErrorMessage(err, "Envoi impossible");
      showToast(message, "error", "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll keyboardAware background={colors.background}>
      {/* Bouton retour en haut */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Retour</Text>
      </Pressable>

      {sent ? (
        // === État succès ===
        <View style={styles.content}>
          <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
            <Ionicons name="mail-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Vérifie ta boîte mail</Text>
          <Text style={styles.body}>
            Si <Text style={styles.bold}>{email.trim()}</Text> est associée à un compte Aspha Pro,
            tu vas recevoir un email avec un lien pour choisir un nouveau mot de passe.
          </Text>
          <Text style={styles.bodyMuted}>
            Le lien est valable 60 minutes. Tu peux le cliquer depuis ton téléphone — la page
            de réinitialisation s'ouvre dans ton navigateur. Une fois ton nouveau mot de passe
            choisi, reviens ici pour te connecter.
          </Text>
          <Text style={styles.bodyMuted}>Pense à vérifier le dossier « spam » si tu ne le trouves pas.</Text>

          <View style={styles.spacer} />

          <Button
            label="Retour à la connexion"
            onPress={() => router.replace("/(auth)/login" as never)}
          />
        </View>
      ) : (
        // === État formulaire ===
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.body}>
            Saisis l'email de ton compte Aspha Pro — on t'envoie un lien pour réinitialiser
            ton mot de passe.
          </Text>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="prenom.nom@aspha.fr"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={() => void handleSubmit()}
            />

            <View style={styles.spacer} />

            <Button label="Envoyer le lien" onPress={handleSubmit} loading={submitting} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  backPressed: {
    opacity: 0.6,
  },
  backText: {
    fontSize: typography.md,
    color: colors.text,
    fontWeight: "600",
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  iconCircleSuccess: {
    backgroundColor: "#dcfce7",
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: typography.base,
    lineHeight: 22,
    color: colors.text,
  },
  bodyMuted: {
    fontSize: typography.sm,
    lineHeight: 20,
    color: colors.textMuted,
  },
  bold: {
    fontWeight: "700",
  },
  form: {
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  spacer: {
    height: spacing.md,
  },
});
