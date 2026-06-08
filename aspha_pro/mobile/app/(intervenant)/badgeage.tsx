// Ecran de badgeage — sprint P0-3.
//
// Flow :
//   1. On lit les params route (`intervention_id` + `event_type` optionnel, defaut `arrival`).
//   2. On demande la permission camera (bloquant) + GPS (best-effort).
//   3. CameraView plein ecran + overlay viseur QR.
//   4. Au 1er scan QR : on debounce immediatement onBarcodeScanned, on tente
//      de recuperer le GPS (timeout 5s, fallback sans GPS), vibration legere,
//      puis POST /telemanagement/badge via useBadgeage().
//   5. Succes -> ecran confirmation plein ecran avec coche + retour planning
//      / badger le depart (si arrivee).
//   6. Erreur -> toast + bouton « Reessayer » qui reactive le scan.
//
// Le backend derive `employee_id` du user authentifie (cf. modif TelemanagementController).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/api";
import { formatTime } from "@/lib/date";
import { colors, radius, spacing, typography } from "@/lib/theme";
import {
  useBadgeage,
  type BadgeEventType,
  type BadgeResponseData,
} from "@/hooks/use-badgeage";

// ============================================================
// Helpers
// ============================================================

function parseEventType(raw: string | string[] | undefined): BadgeEventType {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "departure" ? "departure" : "arrival";
}

function parseInterventionId(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function eventTypeLabel(t: BadgeEventType): string {
  return t === "arrival" ? "Arrivée" : "Départ";
}

// Recupere la position courante avec un timeout dur cote JS.
// expo-location n'expose pas de timeout natif fiable sur toutes les plates-formes,
// donc on race avec un setTimeout. Si timeout -> on retourne null silencieusement
// (le badge sera enregistre sans coords, flag_no_gps=true cote backend).
async function getCurrentPositionWithTimeout(
  timeoutMs: number,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const result = await Promise.race<
      Awaited<ReturnType<typeof Location.getCurrentPositionAsync>> | "timeout"
    >([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
    ]);
    if (result === "timeout") return null;
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
    };
  } catch (err) {
    console.error("[badgeage] geolocation error", err);
    return null;
  }
}

// ============================================================
// Ecran
// ============================================================

type Phase = "scanning" | "manual" | "submitting" | "success" | "error";

export default function BadgeageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    intervention_id?: string;
    event_type?: string;
  }>();

  const interventionId = parseInterventionId(params.intervention_id);
  const initialEventType = parseEventType(params.event_type);

  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  // Etat de scan
  const [phase, setPhase] = useState<Phase>("scanning");
  const [eventType, setEventType] = useState<BadgeEventType>(initialEventType);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [result, setResult] = useState<BadgeResponseData | null>(null);
  // Saisie manuelle : valeur de l'input + submit en cours.
  const [manualCode, setManualCode] = useState<string>("");

  // Debounce du scanner : ref synchrone pour bloquer le 2eme tick d'un meme scan
  // (cf. lessons.md 2026-05-19 — useState async laisse passer le double-fire
  // dans le meme render). On RESET ce ref a chaque focus pour permettre un
  // nouveau scan apres retour sur l'ecran.
  const scanLockRef = useRef(false);

  const mutation = useBadgeage();

  // ============================================================
  // Permissions au mount
  // ============================================================

  useEffect(() => {
    // Camera : si non determine, on demande direct. Le user voit la prompt
    // native iOS / Android.
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    // GPS : best-effort. Si refuse, on continue sans (badge degrade).
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!cancelled) setLocationGranted(status === "granted");
      } catch (err) {
        console.error("[badgeage] location permission error", err);
        if (!cancelled) setLocationGranted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // Reset etat a chaque focus (permet un nouveau scan)
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      // Au retour sur l'ecran (apres navigation back depuis un autre screen),
      // on remet l'ecran en mode scan + on re-applique l'event_type initial.
      setPhase("scanning");
      setEventType(parseEventType(params.event_type));
      setErrorMessage("");
      setResult(null);
      scanLockRef.current = false;
      return () => {
        // cleanup : on lock pour eviter qu'un scan partiel arrive apres
        // un blur (defensive — la CameraView est demonte de toute facon).
        scanLockRef.current = true;
      };
      // params.event_type est stable au montage ; on ne re-run pas a chaque
      // navigation au sein de l'ecran.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Securite : si l'app passe en background pendant le scan, on garde l'etat
  // mais on lock le scanner. Au retour focus, le useFocusEffect au-dessus
  // re-deverrouille.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") scanLockRef.current = true;
    });
    return () => sub.remove();
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  // Helper unique : POST badge avec un qr_code donne (scan OU manuel).
  // Gere haptic, GPS, mutation, transitions de phase, toast d'erreur.
  // Le caller a la responsabilite de poser scanLockRef et setPhase("submitting")
  // AVANT d'appeler ce helper s'il vient d'un scan camera (anti double-fire).
  const submitBadge = useCallback(
    async (qrCode: string) => {
      // Haptic medium : confirme au user que la soumission a commence.
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // ignore — Haptics n'est pas critique
      }

      // GPS best-effort (timeout 5s). Si pas de permission ou timeout, on
      // continue sans coords.
      let coords: { latitude: number; longitude: number } | null = null;
      if (locationGranted === true) {
        coords = await getCurrentPositionWithTimeout(5_000);
      }

      try {
        const response = await mutation.mutateAsync({
          qr_code: qrCode,
          event_type: eventType,
          intervention_id: interventionId,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        });
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // ignore
        }
        setResult(response);
        setPhase("success");
      } catch (err) {
        console.error("[badgeage] POST /telemanagement/badge failed", err);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          // ignore
        }
        const msg = apiErrorMessage(err, "Impossible d'enregistrer le badgeage");
        setErrorMessage(msg);
        showToast(msg, "error");
        setPhase("error");
      }
    },
    [eventType, interventionId, locationGranted, mutation],
  );

  const onBarcodeScanned = useCallback(
    async (event: BarcodeScanningResult) => {
      if (scanLockRef.current) return;
      if (phase !== "scanning") return;

      // Lock IMMEDIAT (avant tout await) pour empecher le double-fire.
      scanLockRef.current = true;
      setPhase("submitting");

      const qrCode = event.data?.trim();
      if (!qrCode) {
        showToast("QR code illisible, réessaie", "error");
        setPhase("scanning");
        scanLockRef.current = false;
        return;
      }

      await submitBadge(qrCode);
    },
    [phase, submitBadge],
  );

  // Bascule scan camera ↔ saisie manuelle (fallback si camera HS / refusee).
  const onOpenManual = useCallback(() => {
    setManualCode("");
    setErrorMessage("");
    setPhase("manual");
    scanLockRef.current = false;
  }, []);

  const onCancelManual = useCallback(() => {
    setManualCode("");
    setPhase("scanning");
    scanLockRef.current = false;
  }, []);

  const onSubmitManual = useCallback(async () => {
    // Validation au clic (pas de submit disabled metier).
    const code = manualCode.trim();
    if (!code) {
      showToast("Saisis le code du QR pour valider", "error");
      return;
    }
    setPhase("submitting");
    await submitBadge(code);
  }, [manualCode, submitBadge]);

  const onRetry = useCallback(() => {
    setErrorMessage("");
    setResult(null);
    setPhase("scanning");
    scanLockRef.current = false;
  }, []);

  const onClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(intervenant)/planning" as never);
    }
  }, [router]);

  const onOpenSettings = useCallback(() => {
    void Linking.openSettings().catch((err) => {
      console.error("[badgeage] openSettings", err);
      showToast("Impossible d'ouvrir les réglages", "error");
    });
  }, []);

  const onSwitchToDeparture = useCallback(() => {
    setEventType("departure");
    setResult(null);
    setErrorMessage("");
    setPhase("scanning");
    scanLockRef.current = false;
  }, []);

  // ============================================================
  // Render
  // ============================================================

  // 1. Permission camera en attente de reponse
  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // 2. Permission camera refusee
  if (!cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.permissionScreen}>
          <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Caméra requise</Text>
          <Text style={styles.permissionBody}>
            Pour scanner un QR code de badgeage, autorise l'accès à la caméra dans les réglages
            du téléphone.
          </Text>
          <View style={styles.permissionActions}>
            {cameraPermission.canAskAgain ? (
              <Button
                label="Autoriser la caméra"
                onPress={() => void requestCameraPermission()}
              />
            ) : (
              <Button label="Ouvrir les réglages" onPress={onOpenSettings} />
            )}
            <View style={{ height: spacing.sm }} />
            <Button
              label="Saisir le code à la main"
              onPress={onOpenManual}
              variant="outline"
            />
            <View style={{ height: spacing.sm }} />
            <Button label="Retour" onPress={onClose} variant="ghost" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 2bis. Mode saisie manuelle (fallback caméra HS / refusée / pas pratique)
  if (phase === "manual") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.manualScreen}>
          <Ionicons name="keypad-outline" size={56} color={colors.primary} />
          <Text style={styles.permissionTitle}>Saisie manuelle</Text>
          <Text style={styles.permissionBody}>
            Saisis le code inscrit sous le QR du site d'intervention (généralement 8 caractères,
            chiffres et lettres).
          </Text>

          <View style={styles.manualInputBlock}>
            <Text style={styles.manualLabel}>Code QR</Text>
            <TextInput
              value={manualCode}
              onChangeText={(text) => setManualCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              placeholder="ASPHA-XXXX"
              placeholderTextColor={colors.textMuted}
              style={styles.manualInput}
              returnKeyType="go"
              onSubmitEditing={() => void onSubmitManual()}
            />
            {/* Toggle Arrivée / Départ — meme logique que sur le viseur. */}
            <View style={styles.eventToggleLight}>
              <Pressable
                onPress={() => setEventType("arrival")}
                style={[
                  styles.eventToggleBtnLight,
                  eventType === "arrival" && styles.eventToggleBtnActive,
                ]}
              >
                <Ionicons
                  name="log-in-outline"
                  size={16}
                  color={eventType === "arrival" ? colors.textInverse : colors.textMuted}
                />
                <Text
                  style={[
                    styles.eventToggleTextLight,
                    eventType === "arrival" && styles.eventToggleTextLightActive,
                  ]}
                >
                  Arrivée
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEventType("departure")}
                style={[
                  styles.eventToggleBtnLight,
                  eventType === "departure" && styles.eventToggleBtnActive,
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={16}
                  color={eventType === "departure" ? colors.textInverse : colors.textMuted}
                />
                <Text
                  style={[
                    styles.eventToggleTextLight,
                    eventType === "departure" && styles.eventToggleTextLightActive,
                  ]}
                >
                  Départ
                </Text>
              </Pressable>
            </View>
            {interventionId ? (
              <Text style={styles.manualHint}>RDV #{interventionId}</Text>
            ) : null}
          </View>

          <View style={styles.permissionActions}>
            <Button
              label="Valider le badgeage"
              onPress={() => void onSubmitManual()}
              loading={mutation.isPending}
            />
            <View style={{ height: spacing.sm }} />
            {cameraPermission.granted && (
              <Button label="Retour au scan" onPress={onCancelManual} variant="outline" />
            )}
            <View style={{ height: spacing.sm }} />
            <Button label="Annuler" onPress={onClose} variant="ghost" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Ecran de succes
  if (phase === "success" && result) {
    const checkinTime =
      eventType === "arrival" ? result.checkin.checkin_time : result.checkin.checkout_time;
    const displayTime = checkinTime ? formatTime(new Date(checkinTime)) : "—";
    const noGps = result.checkin.flag_no_gps;

    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.successScreen}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={64} color={colors.textInverse} />
          </View>
          <Text style={styles.successTitle}>
            {eventTypeLabel(eventType)} enregistrée
          </Text>
          <Text style={styles.successSubtitle}>
            à {displayTime}
            {noGps ? " · sans GPS" : ""}
          </Text>

          <View style={styles.successActions}>
            {eventType === "arrival" ? (
              <>
                <Button label="Badger le départ" onPress={onSwitchToDeparture} />
                <View style={{ height: spacing.sm }} />
                <Button label="Retour au planning" onPress={onClose} variant="outline" />
              </>
            ) : (
              <Button label="Retour au planning" onPress={onClose} />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Ecran d'erreur (apres echec POST)
  if (phase === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.permissionScreen}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
          <Text style={styles.permissionTitle}>Badgeage refusé</Text>
          <Text style={styles.permissionBody}>{errorMessage || "Erreur inconnue."}</Text>
          <View style={styles.permissionActions}>
            <Button label="Réessayer" onPress={onRetry} />
            <View style={{ height: spacing.sm }} />
            <Button label="Retour" onPress={onClose} variant="ghost" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 5. Scan en cours (par defaut)
  const scanLocked = phase !== "scanning";

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom", "left", "right"]}
    >
      {/* CameraView plein ecran. onBarcodeScanned mis a undefined quand on a
          deja scanne pour bloquer le scanner natif (en plus du scanLockRef). */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanLocked ? undefined : onBarcodeScanned}
      />

      {/* Overlay header */}
      <View style={styles.overlayHeader} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.overlayClose, pressed && styles.overlayClosePressed]}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={colors.textInverse} />
        </Pressable>
        <View style={styles.overlayTitleWrap}>
          <Text style={styles.overlayTitle}>Scanner le QR de badgeage</Text>
          {interventionId != null ? (
            <Text style={styles.overlaySubtitle}>RDV #{interventionId}</Text>
          ) : null}
        </View>
        {/* Spacer pour equilibrer la croix a gauche */}
        <View style={{ width: 26 + spacing.md * 2 }} />
      </View>

      {/* Toggle Arrivée / Départ — l'intervenant peut basculer le mode
          avant de scanner, indépendamment de ce qui vient du RDV. */}
      <View style={styles.eventToggleWrap} pointerEvents="box-none">
        <View style={styles.eventToggle}>
          <Pressable
            onPress={() => setEventType("arrival")}
            style={[
              styles.eventToggleBtn,
              eventType === "arrival" && styles.eventToggleBtnActive,
            ]}
          >
            <Ionicons
              name="log-in-outline"
              size={16}
              color={eventType === "arrival" ? colors.textInverse : "rgba(255,255,255,0.85)"}
            />
            <Text
              style={[
                styles.eventToggleText,
                eventType === "arrival" && styles.eventToggleTextActive,
              ]}
            >
              Arrivée
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setEventType("departure")}
            style={[
              styles.eventToggleBtn,
              eventType === "departure" && styles.eventToggleBtnActive,
            ]}
          >
            <Ionicons
              name="log-out-outline"
              size={16}
              color={eventType === "departure" ? colors.textInverse : "rgba(255,255,255,0.85)"}
            />
            <Text
              style={[
                styles.eventToggleText,
                eventType === "departure" && styles.eventToggleTextActive,
              ]}
            >
              Départ
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Cadre viseur central */}
      <View style={styles.viewfinderWrap} pointerEvents="none">
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* Footer info / statut + bouton saisie manuelle (fallback) */}
      <View style={styles.overlayFooter} pointerEvents="box-none">
        {phase === "submitting" ? (
          <View style={styles.footerCenter}>
            <ActivityIndicator color={colors.textInverse} />
            <Text style={styles.footerHint}>Envoi du badge…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.footerHint}>
              Approche le QR code du cadre
            </Text>
            {locationGranted === false ? (
              <Text style={styles.footerWarn}>
                GPS désactivé · le badge sera enregistré sans position
              </Text>
            ) : null}
            <Pressable
              onPress={onOpenManual}
              style={({ pressed }) => [
                styles.manualLink,
                pressed && styles.manualLinkPressed,
              ]}
            >
              <Ionicons name="keypad-outline" size={18} color={colors.textInverse} />
              <Text style={styles.manualLinkText}>Saisir le code à la main</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const VIEWFINDER_SIZE = 260;
const CORNER_LEN = 28;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  // === Permission / erreur (fond clair) ===
  permissionScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  permissionTitle: {
    marginTop: spacing.lg,
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  permissionBody: {
    marginTop: spacing.sm,
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  permissionActions: {
    marginTop: spacing.xl,
    alignSelf: "stretch",
    paddingHorizontal: spacing.xl,
  },

  // === Saisie manuelle (fallback) ===
  manualScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  manualInputBlock: {
    alignSelf: "stretch",
    marginTop: spacing.xl,
  },
  manualLabel: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  manualInput: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 2,
    textAlign: "center",
  },
  manualHint: {
    marginTop: spacing.xs,
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  manualLink: {
    marginTop: spacing.md,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  manualLinkPressed: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  manualLinkText: {
    color: colors.textInverse,
    fontSize: typography.base,
    fontWeight: "600",
    marginLeft: spacing.xs,
  },

  // === Toggle Arrivée / Départ ===
  eventToggleWrap: {
    position: "absolute",
    top: 110,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  eventToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  eventToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 6,
  },
  eventToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  eventToggleText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: typography.base,
    fontWeight: "600",
  },
  eventToggleTextActive: {
    color: colors.textInverse,
  },

  // === Toggle compact (mode saisie manuelle, fond clair) ===
  eventToggleLight: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.md,
  },
  eventToggleBtnLight: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 6,
  },
  eventToggleTextLight: {
    color: colors.textMuted,
    fontSize: typography.base,
    fontWeight: "600",
  },
  eventToggleTextLightActive: {
    color: colors.textInverse,
  },

  // === Header overlay (au-dessus de la camera) ===
  overlayHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "android" ? spacing.lg : spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  overlayClose: {
    width: 26 + spacing.md * 2,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  overlayClosePressed: {
    opacity: 0.6,
  },
  overlayTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  overlayTitle: {
    color: colors.textInverse,
    fontSize: typography.base,
    fontWeight: "700",
    textAlign: "center",
  },
  overlaySubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: typography.sm,
    marginTop: 2,
    textAlign: "center",
  },

  // === Viseur central ===
  viewfinderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    borderRadius: radius.lg,
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: CORNER_LEN,
    height: CORNER_LEN,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: radius.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: radius.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: radius.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: radius.md,
  },

  // === Footer overlay ===
  overlayFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
  },
  footerCenter: {
    alignItems: "center",
    gap: spacing.sm,
  },
  footerHint: {
    color: colors.textInverse,
    fontSize: typography.base,
    fontWeight: "600",
    textAlign: "center",
  },
  footerWarn: {
    color: "#fde68a",
    fontSize: typography.sm,
    marginTop: spacing.xs,
    textAlign: "center",
  },

  // === Ecran de succes ===
  successScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    marginTop: spacing.xl,
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  successSubtitle: {
    marginTop: spacing.sm,
    fontSize: typography.lg,
    color: colors.textMuted,
    textAlign: "center",
  },
  successActions: {
    marginTop: spacing.xxl,
    alignSelf: "stretch",
  },
});
