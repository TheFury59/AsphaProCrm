import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Device from "expo-device";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/components/ui/Toast";
import { colors, spacing, typography } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

const APP_VERSION = "v0.1.0";

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validation au clic (pas de disabled, conformement aux conventions).
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showToast("Saisis ton email professionnel.", "error", "Email manquant");
      return;
    }
    if (!password) {
      showToast("Saisis ton mot de passe.", "error", "Mot de passe manquant");
      return;
    }

    const deviceName = buildDeviceName();

    setSubmitting(true);
    try {
      await login(trimmedEmail, password, deviceName);
      // Pas besoin de naviguer manuellement : le root layout reagit au status.
    } catch (err) {
      console.error("[login] submit failed", err);
      const message = err instanceof Error ? err.message : "Connexion impossible";
      showToast(message, "error", "Connexion echouee");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll keyboardAware background={colors.background}>
      <View style={styles.header}>
        <Image
          source={require("../../assets/logo-aspha.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>ERP entreprises de services</Text>
      </View>

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
          returnKeyType="next"
        />
        <Input
          label="Mot de passe"
          placeholder="Ton mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
        />

        <Pressable
          onPress={() => router.push("/(auth)/forgot-password" as never)}
          hitSlop={8}
          style={({ pressed }) => [styles.forgotLink, pressed && styles.forgotLinkPressed]}
        >
          <Text style={styles.forgotLinkText}>Mot de passe oublié ?</Text>
        </Pressable>

        <View style={styles.spacer} />

        <Button label="Se connecter" onPress={handleSubmit} loading={submitting} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{APP_VERSION} - Aspha Pro</Text>
      </View>
    </Screen>
  );
}

function buildDeviceName(): string {
  const model = Device.modelName ?? Device.deviceName ?? "Mobile";
  const os = `${Device.osName ?? "OS"} ${Device.osVersion ?? ""}`.trim();
  return `${model} - ${os}`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  logo: {
    width: 180,
    height: 120,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.lg,
  },
  spacer: {
    height: spacing.sm,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
  },
  forgotLinkPressed: {
    opacity: 0.6,
  },
  forgotLinkText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  footer: {
    marginTop: spacing.xxxl,
    alignItems: "center",
  },
  footerText: {
    fontSize: typography.xs,
    color: colors.textSubtle,
  },
});
