// Ecran : uploader un document depuis le téléphone.
//
// Flow :
//  1. Tap "Choisir un fichier" → expo-document-picker (PDF / images / Word)
//  2. Validation client : 10 Mo max (le backend re-vérifie aussi)
//  3. Saisie d'un libellé optionnel (défaut = nom du fichier)
//  4. Tap "Envoyer" → mutation multipart → toast succès → back
//
// On reste sur des mimes-types simples : pdf / images / docs Office (alignés
// avec la validation backend `mimes:pdf,jpg,jpeg,png,webp,doc,docx`).

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";

import {
  formatFileSize,
  getFileIcon,
  useUploadIntervenantDocument,
} from "@/hooks/use-intervenant-documents";
import { colors, radius, spacing, typography } from "@/lib/theme";

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo — aligné backend
const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type PickedFile = {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
};

export default function UploadDocumentScreen() {
  const router = useRouter();
  const uploadMut = useUploadIntervenantDocument();

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [label, setLabel] = useState("");

  const pickedSize = useMemo(
    () => (picked?.size != null ? Math.round(picked.size / 1024) : null),
    [picked],
  );

  const onPickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_MIMES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      // Garde-fou taille côté client (le backend re-valide).
      if (asset.size != null && asset.size > MAX_BYTES) {
        Toast.show({
          type: "error",
          text1: "Fichier trop volumineux",
          text2: "Limite 10 Mo. Réduis la taille ou choisis un autre fichier.",
        });
        return;
      }

      setPicked({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
      });
      // Pré-remplir le label avec le nom du fichier (sans extension) si vide.
      if (label.trim().length === 0) {
        setLabel(asset.name.replace(/\.[^.]+$/, ""));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sélection impossible";
      Toast.show({ type: "error", text1: "Erreur", text2: msg });
    }
  }, [label]);

  const canSubmit = picked != null && label.trim().length > 0 && !uploadMut.isPending;

  const onSubmit = useCallback(() => {
    if (!picked || !canSubmit) return;
    uploadMut.mutate(
      {
        uri: picked.uri,
        name: picked.name,
        mimeType: picked.mimeType,
        label: label.trim(),
      },
      {
        onSuccess: () => {
          Toast.show({ type: "success", text1: "Document ajouté" });
          router.back();
        },
        onError: (e) => {
          Toast.show({
            type: "error",
            text1: "Envoi impossible",
            text2: e.message,
          });
        },
      },
    );
  }, [picked, canSubmit, label, uploadMut, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Ajouter un document" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* === Picker fichier === */}
          <Section title="Fichier" subtitle="PDF, image ou document Word — 10 Mo max.">
            {picked ? (
              <Pressable onPress={onPickFile} style={styles.fileCard}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={getFileIcon(picked.mimeType, picked.name)}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.fileCardBody}>
                  <Text style={styles.fileCardName} numberOfLines={1}>
                    {picked.name}
                  </Text>
                  <Text style={styles.fileCardMeta}>
                    {formatFileSize(pickedSize)} · Toucher pour changer
                  </Text>
                </View>
                <Ionicons name="swap-horizontal-outline" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable onPress={onPickFile} style={styles.pickBtn}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                <Text style={styles.pickBtnText}>Choisir un fichier</Text>
              </Pressable>
            )}
          </Section>

          {/* === Libellé === */}
          <Section
            title="Libellé"
            subtitle="Comment ce document doit-il s'afficher dans ta liste ?"
          >
            <TextInput
              style={styles.input}
              placeholder="Ex. Justificatif transport mai 2026"
              placeholderTextColor={colors.textSubtle}
              value={label}
              onChangeText={setLabel}
              maxLength={255}
            />
          </Section>

          <View style={styles.spacer} />
        </ScrollView>

        {/* === Submit === */}
        <View style={styles.submitWrap}>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            {uploadMut.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
                <Text style={styles.submitBtnText}>Envoyer le document</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionBody: {
    marginTop: spacing.sm,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
  },
  pickBtnText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: typography.base,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  fileCardBody: {
    flex: 1,
    gap: 2,
  },
  fileCardName: {
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
  },
  fileCardMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
    color: colors.text,
    backgroundColor: colors.background,
  },
  spacer: {
    height: spacing.xxl,
  },
  submitWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: typography.base,
  },
});
