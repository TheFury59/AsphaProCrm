// Écran profil intervenant — avatar + infos + logout.
//
// L'avatar se modifie via expo-image-picker (galerie OU appareil photo).
// L'upload réutilise EXACTEMENT le même path de stockage que l'edit côté
// frontend admin (`storage/app/public/avatars/`) — le backend remplace
// atomiquement l'ancien fichier (delete + write) pour éviter d'accumuler
// des orphelins. Voir [[MediaUploadController]] + nouveaux endpoints
// `/extranet/intervenant/avatar`.

import { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/components/ui/Toast";
import {
  getInitials,
  useDeleteIntervenantAvatar,
  useIntervenantProfile,
  useUploadIntervenantAvatar,
} from "@/hooks/use-intervenant-profile";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

export default function ProfilIntervenantScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const profile = useIntervenantProfile();
  const upload = useUploadIntervenantAvatar();
  const remove = useDeleteIntervenantAvatar();

  const [uploading, setUploading] = useState(false);

  const handlePickPhoto = async () => {
    const options = ["Choisir dans la galerie", "Prendre une photo", "Annuler"] as const;
    const cancelIndex = 2;

    const choose = async (index: number) => {
      if (index === 0) await pickFromLibrary();
      else if (index === 1) await pickFromCamera();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options], cancelButtonIndex: cancelIndex, title: "Photo de profil" },
        (i) => void choose(i),
      );
    } else {
      // Android — fallback Alert (les ActionSheet natifs nécessiteraient un lib externe).
      Alert.alert("Photo de profil", undefined, [
        { text: options[0], onPress: () => void pickFromLibrary() },
        { text: options[1], onPress: () => void pickFromCamera() },
        { text: options[2], style: "cancel" },
      ]);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast("Accès aux photos refusé.", "error", "Permission requise");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    await uploadAsset(result);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showToast("Accès caméra refusé.", "error", "Permission requise");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    await uploadAsset(result);
  };

  const uploadAsset = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeType = asset.mimeType ?? (ext === "png" ? "image/png" : "image/jpeg");

    setUploading(true);
    try {
      await upload.mutateAsync({
        uri: asset.uri,
        name: `avatar.${ext}`,
        mimeType,
      });
      showToast("Photo de profil mise à jour.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload impossible";
      showToast(message, "error", "Erreur");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert("Supprimer la photo ?", "Tu pourras en remettre une plus tard.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await remove.mutateAsync();
            showToast("Photo supprimée.", "info");
          } catch (err) {
            const message = err instanceof Error ? err.message : "Suppression impossible";
            showToast(message, "error", "Erreur");
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("[profil] logout failed", err);
      showToast("Déconnexion partielle (token local effacé).", "info");
    }
  };

  const avatarUrl = profile.data?.avatar_url ?? null;
  const initials = getInitials(profile.data, user?.name ?? user?.email ?? "?");
  const isBusy = uploading || upload.isPending || remove.isPending;

  return (
    <Screen scroll>
      {/* === AVATAR === */}
      <View style={styles.avatarBlock}>
        <Pressable onPress={handlePickPhoto} disabled={isBusy} style={styles.avatarPressable}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="camera" size={16} color="#ffffff" />
            )}
          </View>
        </Pressable>

        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        {user?.role ? <Text style={styles.role}>{labelForRole(user.role)}</Text> : null}

        <View style={styles.avatarActions}>
          <Pressable onPress={handlePickPhoto} disabled={isBusy} hitSlop={8}>
            <Text style={styles.linkText}>Changer la photo</Text>
          </Pressable>
          {avatarUrl ? (
            <>
              <Text style={styles.linkSeparator}>·</Text>
              <Pressable onPress={handleRemovePhoto} disabled={isBusy} hitSlop={8}>
                <Text style={[styles.linkText, styles.linkDanger]}>Supprimer</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {/* === INFOS === */}
      {profile.data ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          {profile.data.phone ? (
            <InfoRow icon="call-outline" label="Téléphone" value={profile.data.phone} />
          ) : null}
          {profile.data.entity?.label ? (
            <InfoRow icon="business-outline" label="Entité" value={profile.data.entity.label} />
          ) : null}
        </View>
      ) : null}

      {/* === FOOTER ACTIONS === */}
      <View style={styles.footerActions}>
        <Button label="Se déconnecter" onPress={handleLogout} variant="danger" />
      </View>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={styles.infoRowText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function labelForRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super administrateur";
    case "admin":
      return "Administrateur";
    case "intervenant":
      return "Intervenant terrain";
    case "client":
      return "Client";
    default:
      return role;
  }
}

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  avatarPressable: {
    position: "relative",
    marginBottom: spacing.md,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.surface,
  },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.textInverse,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
  },
  email: {
    fontSize: typography.md,
    color: colors.textMuted,
  },
  role: {
    marginTop: spacing.xs,
    fontSize: typography.xs,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  avatarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  linkSeparator: {
    color: colors.textSubtle,
  },
  linkDanger: {
    color: colors.danger,
  },

  // Sections
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  infoRowText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: typography.base,
    color: colors.text,
    marginTop: 2,
  },

  footerActions: {
    marginTop: spacing.lg,
  },
});
