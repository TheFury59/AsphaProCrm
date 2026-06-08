// Ecran : creer un signalement / ticket cote intervenant.
//
// Le backend exige :
//   client_id (parmi mes-clients), type, subject (max 255), priority (default normal),
//   body (optionnel).
//
// Picker client : on charge /extranet/intervenant/my-clients (clients ou j'ai
// au moins une intervention) - le backend bloque les autres avec un 403.
// Picker type / priorite : selecteur segmente simple.
//
// A la soumission reussie : on revient a la liste et on invalide les caches.

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

import {
  useCreateTicket,
  useIntervenantMyClients,
  ticketTypeLabel,
  ticketPriorityLabel,
  ticketPriorityColor,
  clientDisplayName,
} from "@/hooks/use-intervenant-tickets";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { TicketPriority, TicketType, MyClient } from "@/types/api";

const TYPES: TicketType[] = ["problem_report", "complaint", "consumable_reorder"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

export default function NewSignalementScreen() {
  const router = useRouter();
  const { data: clients, isLoading: clientsLoading } = useIntervenantMyClients();
  const createMut = useCreateTicket();

  const [clientId, setClientId] = useState<number | null>(null);
  const [type, setType] = useState<TicketType>("problem_report");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const canSubmit = useMemo(
    () => clientId != null && subject.trim().length > 0 && !createMut.isPending,
    [clientId, subject, createMut.isPending],
  );

  const onSubmit = useCallback(() => {
    if (!canSubmit || clientId == null) return;
    createMut.mutate(
      {
        client_id: clientId,
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
  }, [canSubmit, clientId, type, priority, subject, body, createMut, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Nouveau signalement" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* === Client === */}
          <Section title="Client concerné" subtitle="Tu ne peux signaler que pour un client chez qui tu interviens.">
            {clientsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (clients?.length ?? 0) === 0 ? (
              <Text style={styles.muted}>
                Aucun client éligible. Tu dois d'abord avoir une intervention
                planifiée chez un client.
              </Text>
            ) : (
              <View style={styles.clientList}>
                {(clients ?? []).map((c) => (
                  <ClientChip
                    key={c.id}
                    client={c}
                    active={clientId === c.id}
                    onPress={() => setClientId(c.id)}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* === Type === */}
          <Section title="Type">
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
          <Section title="Sujet" subtitle="Résume en une phrase ce qui se passe.">
            <TextInput
              style={styles.input}
              placeholder="Ex. Porte d'entrée cassée"
              placeholderTextColor={colors.textSubtle}
              value={subject}
              onChangeText={setSubject}
              maxLength={255}
            />
          </Section>

          {/* === Détails === */}
          <Section title="Détails (facultatif)" subtitle="Tu pourras ajouter des messages dans le fil de discussion après.">
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Décris la situation, ce qui s'est passé, ce qui est nécessaire…"
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
                <Text style={styles.submitBtnText}>Envoyer le signalement</Text>
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

function ClientChip({
  client,
  active,
  onPress,
}: {
  client: MyClient;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.clientChip, active && styles.clientChipActive]}
    >
      <Text style={[styles.clientChipText, active && styles.clientChipTextActive]} numberOfLines={1}>
        {clientDisplayName(client)}
      </Text>
    </Pressable>
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
  muted: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  clientList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  clientChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clientChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  clientChipText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: "600",
  },
  clientChipTextActive: {
    color: "#ffffff",
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  segBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segBtnText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: "600",
  },
  segBtnTextActive: {
    color: "#ffffff",
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
  inputMultiline: {
    minHeight: 120,
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
