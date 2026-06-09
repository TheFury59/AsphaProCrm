// Ecran liste des documents de l'intervenant (RH + self-service).
//
// Layout :
//  ┌─────────────────────────────┐
//  │ SectionList groupé          │
//  │  Contrats                   │
//  │   • Contrat.pdf      [→]    │
//  │  Fiches de paie             │
//  │   • Paie mai 2026.pdf [→]   │
//  │  Mes documents              │
//  │   • Justif.pdf       [×][→] │
//  └─────────────────────────────┘
//  FAB → /documents/upload
//
// Tap sur une card → download via downloadAndSharePdf (réutilisé du PDF
// devis/factures). Sur Android le mime non-PDF tombe aussi sur Sharing
// natif, qui propose Drive/Files/Quick View.
//
// Long-press / bouton trash → suppression UNIQUEMENT si can_delete=true
// (uploads self-service de l'intervenant).

import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import {
  formatFileSize,
  getFileIcon,
  groupDocumentsByCategory,
  useDeleteIntervenantDocument,
  useIntervenantDocuments,
} from "@/hooks/use-intervenant-documents";
import { downloadAndSharePdf } from "@/lib/download-pdf";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { IntervenantDocument } from "@/types/api";

export default function DocumentsListScreen() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch, error } = useIntervenantDocuments();
  const deleteMut = useDeleteIntervenantDocument();

  const sections = useMemo(
    () => groupDocumentsByCategory(data ?? []),
    [data],
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onPressUpload = useCallback(() => {
    router.push("/(intervenant)/documents/upload" as never);
  }, [router]);

  const onPressDoc = useCallback(async (doc: IntervenantDocument) => {
    try {
      // L'endpoint est relatif à baseURL (qui inclut déjà /api/v1) — on
      // strip le préfixe pour éviter le double `/api/v1/api/v1/...`.
      // download_url renvoyé par le backend a la forme :
      // "/api/v1/extranet/intervenant/documents/{id}/download"
      const endpoint = doc.download_url.replace(/^\/api\/v1/, "");
      const filename = ensureExtension(doc.label, doc.mime_type);
      await downloadAndSharePdf(endpoint, filename);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Téléchargement impossible";
      Toast.show({ type: "error", text1: "Téléchargement impossible", text2: msg });
    }
  }, []);

  const onDelete = useCallback(
    (doc: IntervenantDocument) => {
      Alert.alert(
        "Supprimer ce document ?",
        `« ${doc.label} » sera définitivement retiré de tes documents.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => {
              deleteMut.mutate(doc.id, {
                onSuccess: () => {
                  Toast.show({ type: "success", text1: "Document supprimé" });
                },
                onError: (e) => {
                  Toast.show({
                    type: "error",
                    text1: "Suppression impossible",
                    text2: e.message,
                  });
                },
              });
            },
          },
        ],
      );
    },
    [deleteMut],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>Impossible de charger les documents</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = sections.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <SectionList
        sections={sections}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={isEmpty ? styles.emptyWrap : styles.listContent}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <DocCard
            doc={item}
            onPress={() => onPressDoc(item)}
            onDelete={item.can_delete ? () => onDelete(item) : undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ListEmptyComponent={<EmptyState onPressUpload={onPressUpload} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />

      <Pressable
        onPress={onPressUpload}
        accessibilityRole="button"
        accessibilityLabel="Ajouter un document"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}

function DocCard({
  doc,
  onPress,
  onDelete,
}: {
  doc: IntervenantDocument;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const icon = getFileIcon(doc.mime_type, doc.label);
  const date = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
  const size = formatFileSize(doc.size_kb);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {doc.label}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[date, size].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {onDelete ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete();
          }}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityLabel="Supprimer le document"
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function EmptyState({ onPressUpload }: { onPressUpload: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Aucun document</Text>
      <Text style={styles.emptyBody}>
        Les documents déposés par l'agence apparaîtront ici. Tu peux aussi
        ajouter tes propres justificatifs (certificats, attestations…).
      </Text>
      <Pressable onPress={onPressUpload} style={styles.emptyCta}>
        <Ionicons name="add" size={18} color="#ffffff" />
        <Text style={styles.emptyCtaText}>Ajouter mon premier document</Text>
      </Pressable>
    </View>
  );
}

/**
 * Garantit que le filename a une extension (utile pour Sharing iOS qui
 * choisit le viewer selon l'extension).
 */
function ensureExtension(label: string, mimeType: string | null): string {
  if (/\.[a-z0-9]{2,5}$/i.test(label)) return label;
  switch (mimeType) {
    case "application/pdf":
      return `${label}.pdf`;
    case "image/jpeg":
      return `${label}.jpg`;
    case "image/png":
      return `${label}.png`;
    case "image/webp":
      return `${label}.webp`;
    case "application/msword":
      return `${label}.doc`;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return `${label}.docx`;
    default:
      return label;
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    textAlign: "center",
  },
  errorBody: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl + 32,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyBody: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  emptyCtaText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: typography.md,
  },
  sectionHeader: {
    paddingVertical: spacing.sm,
  },
  sectionHeaderText: {
    fontSize: typography.xs,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSeparator: {
    height: spacing.md,
  },
  separator: {
    height: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardPressed: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
  },
  cardMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
