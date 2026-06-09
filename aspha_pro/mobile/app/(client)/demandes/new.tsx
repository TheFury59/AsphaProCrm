// Ecran : creer une demande (ticket) cote client.
//
// Le backend forcera le client_id au client connecte (cf. ExtranetController::
// createClientTicket — pas de spoofing possible). On envoie juste :
//   type, subject, priority, body?
//
// Champs validation : subject required (max 255), body optionnel, type/priority
// requis (defaults raisonnables).

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useRouter, Stack } from "expo-router";

import { useCreateClientTicket } from "@/hooks/use-client-tickets";
import {
  ticketTypeLabel,
  ticketPriorityLabel,
  ticketPriorityColor,
} from "@/hooks/use-intervenant-tickets";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { TicketPriority, TicketType } from "@/types/api";

const TYPES: TicketType[] = ["complaint", "problem_report", "consumable_reorder"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

export default function NewDemandeScreen() {
  const router = useRouter();
  const createMut = useCreateClientTicket();

  const [type, setType] = useState<TicketType>("complaint");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const canSubmit = useMemo(
    () => subject.trim().length > 0 && !createMut.isPending,
    [subject, createMut.isPending],
  );

  const onSubmit = useCallback(() => {
    if (!canSubmit) return;
    createMut.mutate(
      {
        type,
        priority,
        subject: subject.trim(),
        body: body.trim() || null,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: (e) => {
          Alert.alert("Erreur", e.message);
        },
      },
    );
  }, [canSubmit, type, priority, subject, body, createMut, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Nouvelle demande" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* === Type === */}
          <Section title="Type de demande">
            <View style={styles.segmented}>
              {TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.segBtn, type === t && styles.segBtnActive]}
                >
                  <Text style={[styles.segBtnText, type === t && styles.segBtnTextActive]}>
                    {ticketTypeLabel(t)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          {/* === Priorite === */}
          <Section title="Priorité">
            <View style={styles.segmented}>
              {PRIORITIES.map((p) => {
                const active = priority === p;
                const color = ticketPriorityColor(p);
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.segBtn,
                      active && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>
                      {ticketPriorityLabel(p)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* === Sujet === */}
          <Section title="Sujet" subtitle="Résumez votre demande en une phrase.">
            <TextInput
              style={styles.input}
              placeholder="Ex. Problème de propreté dans les locaux"
              placeholderTextColor={colors.textSubtle}
              value={subject}
              onChangeText={setSubject}
              maxLength={255}
            />
          </Section>

          {/* === Details === */}
          <Section
            title="Détails (facultatif)"
            subtitle="Vous pourrez compléter dans le fil de discussion après envoi."
          >
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Décrivez la situation, ce qui s'est passé, vos attentes…"
              placeholderTextColor={colors.textSubtle}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
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
            {createMut.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#ffffff" />
                <Text style={styles.submitBtnText}>Envoyer la demande</Text>
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
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: { fontSize: typography.sm, color: colors.textMuted, marginTop: 2 },
  sectionBody: { marginTop: spacing.sm },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  segBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segBtnText: { fontSize: typography.sm, color: colors.text, fontWeight: "600" },
  segBtnTextActive: { color: "#ffffff" },
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
  inputMultiline: { minHeight: 120 },
  spacer: { height: spacing.xxl },
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
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: typography.base },
});
