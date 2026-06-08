// Push notifications via Expo Push (côté mobile).
//
// Pipeline :
//   1. registerForPushNotifications() — demande la permission, récupère le
//      token Expo, et le POST à `/mobile/push-token`. À appeler après auth.
//   2. setupNotificationTapListener() — écoute le tap sur une notif (app au
//      background ou tuée) et deep-link vers la cible (RDV, ticket, …).
//
// Côté foreground : on monte un NotificationHandler global au module load
// qui décide quoi afficher quand la notif arrive et que l'app est ouverte.
//
// Channels Android : "default" (normales) et "critical" (alarmes — son +
// vibration + light). Doivent matcher `channelId` envoyé par le backend
// (cf. SendPushNotificationJob).

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";

import { api } from "./api";

// === Foreground display ===
// Affiche la bannière + son + entrée liste quand l'app est ouverte.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// === Android channels ===
async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notifications",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563eb",
  });
  await Notifications.setNotificationChannelAsync("critical", {
    name: "Alertes critiques",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 400, 250, 400],
    lightColor: "#dc2626",
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Demande la permission, récupère le token Expo et le synchronise au backend.
 * Renvoie le token ou null en cas d'échec (permission refusée, simulateur, etc.).
 *
 * Idempotent : peut être appelée à chaque connexion ; le backend `updateOrCreate`
 * le token sur le user courant.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[push] Skip — pas un device physique");
    return null;
  }

  await ensureAndroidChannels();

  const existing = await Notifications.getPermissionsAsync();
  let final = existing.status;
  if (existing.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== "granted") {
    console.warn("[push] Permission refusée");
    return null;
  }

  try {
    // En Expo Go : pas besoin de projectId (Expo Go fournit le sien). En
    // dev build / production : on lit `extra.eas.projectId` injecté par
    // `eas init`. On reste tolérant pour ne pas casser le dev sur Expo Go.
    const projectId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Constants.expoConfig?.extra as any)?.eas?.projectId ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Constants as any).easConfig?.projectId;

    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    await api.post("/mobile/push-token", { expo_push_token: token });
    return token;
  } catch (e) {
    console.warn("[push] Enregistrement échoué", e);
    return null;
  }
}

/**
 * Écoute le tap sur une notif (app foreground / background / killed) et
 * navigue vers la cible. Renvoie la subscription — à appeler `.remove()` en
 * cleanup d'effet.
 *
 * Mapping target_type → route :
 *   - intervention → /(intervenant)/rdv/[id]
 *   - autres types (ticket, document, …) : on ouvre simplement le centre de
 *     notif pour l'instant (à enrichir au fil des modules mobiles).
 */
export function setupNotificationTapListener(): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = response.notification.request.content.data as any;
    const type = data?.target_type;
    const id = data?.target_id;

    if (type === "intervention" && id != null) {
      router.push(`/(intervenant)/rdv/${id}` as never);
      return;
    }
    // Fallback : ouvrir le planning. À enrichir au fur et à mesure (ticket,
    // doc, message, …) selon les target_type émis par le backend.
    router.push("/(intervenant)/planning" as never);
  });
}
