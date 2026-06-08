// Detail d'un RDV intervenant.
// Lit l'event depuis le cache react-query partage avec planning.tsx
// (cle [intervenant-planning, fromKey, toKey] = plage par defaut aujourd'hui+7j).
// Si l'event est introuvable (cache vide, deep-link, id invalide) : Toast erreur
// + back. Pas de fetch de fallback dedie : il n'existe pas d'endpoint
// detail event cote intervenant pour l'instant (le planning expose deja tous
// les champs necessaires).

import { useCallback, useMemo } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  eventIdToString,
  useIntervenantPlanning,
  type IntervenantEvent,
} from "@/hooks/use-intervenant-planning";
import {
  addDays,
  formatDateLong,
  formatTime,
  parseLocalNaive,
  startOfToday,
} from "@/lib/date";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";

function statusColor(event: IntervenantEvent): string {
  if (event.status === "realisee") {
    return event.checkin?.checkin_time ? "#22c55e" : "#a855f7";
  }
  switch (event.status) {
    case "annulee":
      return "#ef4444";
    case "a_pourvoir":
      return "#f97316";
    case "planifiee":
      return "#3b82f6";
    case "draft":
    case "terminated":
      return "#94a3b8";
  }
}

function statusLabel(event: IntervenantEvent): string {
  if (event.status === "realisee") {
    return event.checkin?.checkin_time ? "Terminé" : "Terminé (non badgé)";
  }
  switch (event.status) {
    case "annulee":
      return "Annulé";
    case "a_pourvoir":
      return "À pourvoir";
    case "planifiee":
      return "Planifié";
    case "draft":
      return "Brouillon";
    case "terminated":
      return "Clos";
  }
}

function clientDisplayName(client: IntervenantEvent["client"]): string {
  if (client.company_name && client.company_name.trim().length > 0) {
    return client.company_name;
  }
  const first = client.first_name?.trim() ?? "";
  const last = client.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : `Client ${client.code}`;
}

function buildMapsUrl(addr: IntervenantEvent["client"]["address"]): string | null {
  if (!addr) return null;
  const label = `${addr.address} ${addr.postal_code} ${addr.city}`.trim();
  const hasCoords =
    typeof addr.latitude === "number" &&
    typeof addr.longitude === "number" &&
    Number.isFinite(addr.latitude) &&
    Number.isFinite(addr.longitude);

  if (Platform.OS === "ios") {
    if (hasCoords) {
      // Apple Maps schema natif. Fallback https geree par openMaps si echec.
      return `maps://?daddr=${addr.latitude},${addr.longitude}`;
    }
    return `maps://?daddr=${encodeURIComponent(label)}`;
  }
  // Android
  if (hasCoords) {
    return `geo:${addr.latitude},${addr.longitude}?q=${addr.latitude},${addr.longitude}(${encodeURIComponent(label)})`;
  }
  return `geo:0,0?q=${encodeURIComponent(label)}`;
}

function buildMapsFallbackUrl(addr: IntervenantEvent["client"]["address"]): string | null {
  if (!addr) return null;
  const hasCoords =
    typeof addr.latitude === "number" &&
    typeof addr.longitude === "number" &&
    Number.isFinite(addr.latitude) &&
    Number.isFinite(addr.longitude);
  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`;
  }
  const label = `${addr.address} ${addr.postal_code} ${addr.city}`.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}`;
}

export default function RdvDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? "";

  // Meme plage que le planning ecran => meme cache-key => lecture instantanee.
  const range = useMemo(() => {
    const from = startOfToday();
    const to = addDays(from, 7);
    return { from, to };
  }, []);
  const query = useIntervenantPlanning(range.from, range.to);

  const event = useMemo<IntervenantEvent | null>(() => {
    if (!query.data || id.length === 0) return null;
    return query.data.find((e) => eventIdToString(e.id) === id) ?? null;
  }, [query.data, id]);

  const onBackNotFound = useCallback(() => {
    showToast("Impossible de retrouver ce RDV", "error");
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(intervenant)/planning" as never);
    }
  }, [router]);

  const onPressPhone = useCallback((phone: string) => {
    const url = `tel:${phone}`;
    Linking.openURL(url).catch((err: unknown) => {
      console.error("[rdv] tel openURL", err);
      showToast("Impossible d'ouvrir l'app telephone", "error");
    });
  }, []);

  const onPressEmail = useCallback((email: string) => {
    const url = `mailto:${email}`;
    Linking.openURL(url).catch((err: unknown) => {
      console.error("[rdv] mailto openURL", err);
      showToast("Impossible d'ouvrir l'app mail", "error");
    });
  }, []);

  const onPressItinerary = useCallback(async () => {
    if (!event?.client.address) {
      showToast("Adresse non renseignee", "info");
      return;
    }
    const primary = buildMapsUrl(event.client.address);
    const fallback = buildMapsFallbackUrl(event.client.address);
    if (!primary) {
      showToast("Adresse incomplete", "info");
      return;
    }
    try {
      const supported = await Linking.canOpenURL(primary);
      if (supported) {
        await Linking.openURL(primary);
        return;
      }
      if (fallback) {
        await Linking.openURL(fallback);
        return;
      }
      showToast("Aucune app cartographique disponible", "error");
    } catch (err) {
      console.error("[rdv] itineraire openURL", err);
      // Tentative fallback en dernier recours.
      if (fallback) {
        try {
          await Linking.openURL(fallback);
          return;
        } catch (err2) {
          console.error("[rdv] itineraire fallback", err2);
        }
      }
      showToast("Impossible d'ouvrir l'itineraire", "error");
    }
  }, [event]);

  const onPressBadgeage = useCallback(() => {
    if (!event) return;
    // Si le RDV est deja « realisee » avec un checkin (arrivee badgee), on
    // pousse le mode « depart » par defaut sur l'ecran de scan.
    const defaultEventType: "arrival" | "departure" =
      event.status === "realisee" && event.checkin?.checkin_time && !event.checkin?.checkout_time
        ? "departure"
        : "arrival";
    router.push({
      pathname: "/(intervenant)/badgeage",
      params: {
        intervention_id: String(event.intervention_id),
        event_type: defaultEventType,
      },
    } as never);
  }, [event, router]);

  // Loading : le cache est en cours d'hydration depuis le planning ; on attend.
  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.subtleMessage}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundTitle}>RDV introuvable</Text>
          <Text style={styles.subtleMessage}>
            Il a peut-etre ete supprime ou la session a expire.
          </Text>
          <View style={styles.notFoundActions}>
            <Button label="Retour au planning" onPress={onBackNotFound} fullWidth={false} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const start = parseLocalNaive(event.start_datetime);
  const end = parseLocalNaive(event.end_datetime);
  const dateLine = start ? formatDateLong(start) : "—";
  const timeLine = start && end ? `${formatTime(start)} - ${formatTime(end)}` : "—";
  const color = statusColor(event);
  const label = statusLabel(event);
  const name = clientDisplayName(event.client);
  const addr = event.client.address;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ============== HEADER ============== */}
        <View style={styles.headerBlock}>
          <Text style={styles.dateLong}>{dateLine}</Text>
          <Text style={styles.time}>{timeLine}</Text>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={styles.statusBadgeText}>{label}</Text>
          </View>
        </View>

        {/* ============== CLIENT ============== */}
        <Section title="Client">
          <Text style={styles.clientName}>{name}</Text>
          {event.client.phone ? (
            <ActionRow
              icon="call-outline"
              label={event.client.phone}
              onPress={() => onPressPhone(event.client.phone ?? "")}
            />
          ) : null}
          {event.client.email ? (
            <ActionRow
              icon="mail-outline"
              label={event.client.email}
              onPress={() => onPressEmail(event.client.email ?? "")}
            />
          ) : null}
        </Section>

        {/* ============== ADRESSE ============== */}
        {addr ? (
          <Section title="Adresse">
            <Text style={styles.addressLine}>{addr.address}</Text>
            <Text style={styles.addressLine}>
              {addr.postal_code} {addr.city}
            </Text>
            <View style={styles.itineraryWrap}>
              <Button
                label="Itineraire"
                onPress={onPressItinerary}
                variant="primary"
                leftIcon={<Ionicons name="navigate-outline" size={18} color={colors.textInverse} />}
              />
            </View>
          </Section>
        ) : null}

        {/* ============== CLES ============== */}
        {event.has_keys ? (
          <View style={styles.keyBox}>
            <Text style={styles.keyBoxText}>
              🔑 {event.keys_count} cle{event.keys_count > 1 ? "s" : ""} a recuperer
            </Text>
          </View>
        ) : null}

        {/* ============== PRESTATION ============== */}
        {event.prestation ? (
          <Section title="Prestation">
            <Text style={styles.prestationLabel}>{event.prestation.label}</Text>
            {event.prestation.product_name ? (
              <Text style={styles.prestationProduct}>{event.prestation.product_name}</Text>
            ) : null}
          </Section>
        ) : null}

        {/* ============== CONSIGNES CLIENT (intervenant_notes) ============== */}
        {event.client.intervenant_notes ? (
          <InfoBlock
            tone="info"
            title="Consignes pour les intervenants"
            body={event.client.intervenant_notes}
          />
        ) : null}

        {/* ============== NOTE INTERNE RDV ============== */}
        {event.internal_comment ? (
          <InfoBlock
            tone="warning"
            title="Note interne du RDV"
            body={event.internal_comment}
          />
        ) : null}

        {/* ============== COMMENTAIRE PUBLIC ============== */}
        {event.comment ? (
          <Section title="Commentaire">
            <Text style={styles.bodyText}>{event.comment}</Text>
          </Section>
        ) : null}

        {/* ============== CTA BADGEAGE ============== */}
        <View style={styles.ctaWrap}>
          <Button
            label={
              event.status === "realisee" &&
              event.checkin?.checkin_time &&
              !event.checkin?.checkout_time
                ? "Marquer le départ"
                : "Lancer le badgeage"
            }
            onPress={onPressBadgeage}
            size="lg"
            leftIcon={<Ionicons name="qr-code-outline" size={20} color={colors.textInverse} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Sous-composants
// ============================================================

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

type ActionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function ActionRow({ icon, label, onPress }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

type InfoBlockProps = {
  tone: "info" | "warning";
  title: string;
  body: string;
};

function InfoBlock({ tone, title, body }: InfoBlockProps) {
  const palette = tone === "info"
    ? { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" }
    : { bg: "#fffbeb", border: "#fde68a", text: "#92400e" };
  return (
    <View
      style={[
        styles.infoBlock,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.infoBlockTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.infoBlockBody, { color: palette.text }]}>{body}</Text>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  notFoundTitle: {
    marginTop: spacing.md,
    fontSize: typography.lg,
    fontWeight: "600",
    color: colors.text,
  },
  subtleMessage: {
    marginTop: spacing.xs,
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  notFoundActions: {
    marginTop: spacing.lg,
  },
  headerBlock: {
    marginBottom: spacing.xl,
  },
  dateLong: {
    fontSize: typography.lg,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  time: {
    fontSize: typography.xxxl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.xs,
  },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    color: colors.textInverse,
    fontSize: typography.sm,
    fontWeight: "700",
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  clientName: {
    fontSize: typography.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  actionRowPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
  },
  addressLine: {
    fontSize: typography.base,
    color: colors.text,
    marginBottom: 2,
  },
  itineraryWrap: {
    marginTop: spacing.md,
  },
  keyBox: {
    backgroundColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  keyBoxText: {
    color: colors.textInverse,
    fontSize: typography.base,
    fontWeight: "700",
  },
  prestationLabel: {
    fontSize: typography.base,
    fontWeight: "600",
    color: colors.text,
  },
  prestationProduct: {
    marginTop: 2,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  bodyText: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 22,
  },
  infoBlock: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoBlockTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  infoBlockBody: {
    fontSize: typography.base,
    lineHeight: 22,
  },
  ctaWrap: {
    marginTop: spacing.lg,
  },
});
