// Ecran : detail d'un devis client.
//
// Affichage :
//  - Header : reference + statut + montant TTC + comment
//  - Liste des items (description, qte, PU, total ligne)
//  - Si status=sent : 2 boutons Valider / Refuser (confirm Alert pour Refuser)
//  - Sinon : badge statut seul (deja accepted/refused/draft)
//  - Bouton "Telecharger le PDF" (toujours dispo)
//
// On lit le devis depuis le cache liste pour eviter un fetch detail dedie
// (le backend renvoie deja items avec les quotes — cf. ExtranetController::clientQuotes).

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import {
  useAcceptClientQuote,
  useClientQuotes,
  useRefuseClientQuote,
  quoteStatusLabel,
  quoteStatusColor,
  formatMoney,
} from "@/hooks/use-client-quotes";
import { downloadAndSharePdf } from "@/lib/download-pdf";
import { showToast } from "@/components/ui/Toast";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Quote, QuoteItem } from "@/types/api";

export default function DevisDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(params.id);
  const qc = useQueryClient();

  const list = useClientQuotes();
  const quote = useMemo<Quote | null>(() => {
    const all = list.data ?? qc.getQueryData<Quote[]>(["client-quotes"]) ?? [];
    return all.find((q) => q.id === quoteId) ?? null;
  }, [list.data, quoteId, qc]);

  const acceptMut = useAcceptClientQuote();
  const refuseMut = useRefuseClientQuote();
  const [downloading, setDownloading] = useState(false);

  const onAccept = useCallback(() => {
    Alert.alert(
      "Valider ce devis ?",
      "Cela confirme votre accord. Une facture vous sera envoyée prochainement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Valider",
          style: "default",
          onPress: () => {
            acceptMut.mutate(quoteId, {
              onSuccess: () => showToast("Devis validé.", "success"),
              onError: (e) => Alert.alert("Erreur", e.message),
            });
          },
        },
      ],
    );
  }, [acceptMut, quoteId]);

  const onRefuse = useCallback(() => {
    Alert.alert(
      "Refuser ce devis ?",
      "Cette action est définitive. Vous devrez contacter votre commercial pour en générer un nouveau.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Refuser",
          style: "destructive",
          onPress: () => {
            refuseMut.mutate(quoteId, {
              onSuccess: () => showToast("Devis refusé.", "info"),
              onError: (e) => Alert.alert("Erreur", e.message),
            });
          },
        },
      ],
    );
  }, [refuseMut, quoteId]);

  const onDownloadPdf = useCallback(async () => {
    if (!quote) return;
    setDownloading(true);
    try {
      const filename = `${quote.reference ?? `devis-${quote.id}`}.pdf`;
      await downloadAndSharePdf(`/extranet/client/quotes/${quote.id}/pdf`, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Téléchargement impossible";
      Alert.alert("Erreur", message);
    } finally {
      setDownloading(false);
    }
  }, [quote]);

  if (!quote) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <Stack.Screen options={{ title: "Devis" }} />
        <View style={styles.center}>
          {list.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={36} color={colors.textMuted} />
              <Text style={styles.errorText}>Devis introuvable.</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const canValidate = quote.status === "sent";
  const items = quote.items ?? [];
  const isMutating = acceptMut.isPending || refuseMut.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: quote.reference ?? `Devis #${quote.id}`,
          headerBackTitle: "Retour",
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* === Header === */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.headerRef} numberOfLines={1}>
              {quote.reference ?? `Devis #${quote.id}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: quoteStatusColor(quote.status) }]}>
              <Text style={styles.statusBadgeText}>{quoteStatusLabel(quote.status)}</Text>
            </View>
          </View>
          <Text style={styles.headerAmount}>{formatMoney(quote.total)}</Text>
          <Text style={styles.headerAmountLabel}>Total TTC</Text>
          {quote.quote_date ? (
            <Text style={styles.headerMeta}>
              Émis le {formatDate(quote.quote_date)}
              {quote.validity_date ? ` · Valable jusqu'au ${formatDate(quote.validity_date)}` : ""}
            </Text>
          ) : null}
          {quote.comment ? (
            <View style={styles.commentBlock}>
              <Text style={styles.commentLabel}>Commentaire</Text>
              <Text style={styles.commentText}>{quote.comment}</Text>
            </View>
          ) : null}
        </View>

        {/* === Items === */}
        <Text style={styles.sectionTitle}>Détail des prestations</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>Aucune ligne dans ce devis.</Text>
        ) : (
          <View style={styles.itemsList}>
            {items.map((it) => (
              <ItemRow key={it.id} item={it} />
            ))}
          </View>
        )}

        {/* === PDF === */}
        <Pressable
          onPress={onDownloadPdf}
          disabled={downloading}
          style={({ pressed }) => [
            styles.pdfBtn,
            pressed && styles.pdfBtnPressed,
            downloading && styles.pdfBtnDisabled,
          ]}
        >
          {downloading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.primary} />
              <Text style={styles.pdfBtnText}>Télécharger le PDF</Text>
            </>
          )}
        </Pressable>

        {/* === Actions === */}
        {canValidate ? (
          <View style={styles.actionsBlock}>
            <Pressable
              onPress={onAccept}
              disabled={isMutating}
              style={[styles.actionBtn, styles.actionBtnAccept, isMutating && styles.actionBtnDisabled]}
            >
              {acceptMut.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Valider le devis</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={onRefuse}
              disabled={isMutating}
              style={[styles.actionBtn, styles.actionBtnRefuse, isMutating && styles.actionBtnDisabled]}
            >
              {refuseMut.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Refuser</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.infoBlock}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>
              Ce devis est {quoteStatusLabel(quote.status).toLowerCase()}. Aucune action n'est disponible.
            </Text>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ItemRow({ item }: { item: QuoteItem }) {
  const qty = typeof item.quantity === "string" ? Number(item.quantity) : item.quantity;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemMeta}>
          {formatQty(qty)} × {formatMoney(item.unit_price)}
        </Text>
      </View>
      <Text style={styles.itemTotal}>{formatMoney(item.total)}</Text>
    </View>
  );
}

function formatQty(q: number): string {
  if (!Number.isFinite(q)) return "—";
  if (Number.isInteger(q)) return String(q);
  return q.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { marginTop: spacing.sm, color: colors.textMuted },

  scroll: { padding: spacing.lg },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerRef: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    color: "#ffffff",
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  headerAmount: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  headerAmountLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerMeta: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  commentBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  commentText: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  itemsList: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  itemMain: { flex: 1, gap: 2 },
  itemLabel: {
    fontSize: typography.base,
    color: colors.text,
    fontWeight: "600",
  },
  itemMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  itemTotal: {
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
  },

  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  pdfBtnPressed: { opacity: 0.7 },
  pdfBtnDisabled: { opacity: 0.5 },
  pdfBtnText: { color: colors.primary, fontWeight: "700", fontSize: typography.base },

  actionsBlock: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  actionBtnAccept: { backgroundColor: colors.success },
  actionBtnRefuse: { backgroundColor: colors.danger },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: "#ffffff", fontWeight: "700", fontSize: typography.base },

  infoBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});
