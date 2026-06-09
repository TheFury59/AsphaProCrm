// Ecran profil client — logo entreprise + infos read-only + logout.
//
// Pattern d'upload logo : identique a profil intervenant (cf. useUploadIntervenantAvatar
// et `mobile/app/(intervenant)/profil.tsx`) — ImagePicker → multipart → invalidation.
// Les infos critiques (raison sociale, SIRET, TVA) restent en read-only : modifs
// passent par l'admin Aspha. On affiche un toast "Bientôt disponible" sur le
// bouton edit pour V1.

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
  getCompanyInitials,
  useClientProfile,
  useDeleteClientLogo,
  useUploadClientLogo,
} from "@/hooks/use-client-profile";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

export default function ProfilClientScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const profile = useClientProfile();
  const upload = useUploadClientLogo();
  const remove = useDeleteClientLogo();

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
        { options: [...options], cancelButtonIndex: cancelIndex, title: "Logo entreprise" },
        (i) => void choose(i),
      );
    } else {
      Alert.alert("Logo entreprise", undefined, [
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
        name: `logo.${ext}`,
        mimeType,
      });
      showToast("Logo entreprise mis à jour.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload impossible";
      showToast(message, "error", "Erreur");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert("Supprimer le logo ?", "Vous pourrez en remettre un plus tard.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await remove.mutateAsync();
            showToast("Logo supprimé.", "info");
          } catch (err) {
            const message = err instanceof Error ? err.message : "Suppression impossible";
            showToast(message, "error", "Erreur");
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    Alert.alert(
      "Bientôt disponible",
      "L'édition des informations entreprise depuis le mobile arrivera dans une prochaine version. Contactez votre commercial Aspha pour toute modification.",
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("[profil-client] logout failed", err);
      showToast("Déconnexion partielle (token local effacé).", "info");
    }
  };

  const company = profile.data?.company ?? null;
  const logoUrl = company?.logo_url ?? null;
  const initials = getCompanyInitials(profile.data, user?.name ?? "?");
  const isBusy = uploading || upload.isPending || remove.isPending;

  return (
    <Screen scroll>
      {/* === LOGO === */}
      <View style={styles.avatarBlock}>
        <Pressable onPress={handlePickPhoto} disabled={isBusy} style={styles.avatarPressable}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.avatar} />
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

        <Text style={styles.name}>{company?.company_name ?? user?.name ?? "—"}</Text>
        {profile.data?.code ? (
          <Text style={styles.code}>Code client : {profile.data.code}</Text>
        ) : null}

        <View style={styles.avatarActions}>
          <Pressable onPress={handlePickPhoto} disabled={isBusy} hitSlop={8}>
            <Text style={styles.linkText}>Changer le logo</Text>
          </Pressable>
          {logoUrl ? (
            <>
              <Text style={styles.linkSeparator}>·</Text>
              <Pressable onPress={handleRemovePhoto} disabled={isBusy} hitSlop={8}>
                <Text style={[styles.linkText, styles.linkDanger]}>Supprimer</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {/* === COMPANY INFO === */}
      {company ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entreprise</Text>
          {company.legal_form ? (
            <InfoRow icon="business-outline" label="Forme juridique" value={company.legal_form} />
          ) : null}
          {company.siret ? (
            <InfoRow icon="finger-print-outline" label="SIRET" value={company.siret} />
          ) : null}
          {company.vat_number ? (
            <InfoRow icon="document-text-outline" label="TVA intracom." value={company.vat_number} />
          ) : null}
          {company.phone_landline ? (
            <InfoRow icon="call-outline" label="Téléphone" value={company.phone_landline} />
          ) : null}
          {company.primary_email ? (
            <InfoRow icon="mail-outline" label="Email" value={company.primary_email} />
          ) : null}
        </View>
      ) : null}

      {/* === ADDRESSES === */}
      {profile.data?.addresses && profile.data.addresses.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresses</Text>
          {profile.data.addresses.map((addr) => (
            <InfoRow
              key={addr.id}
              icon="location-outline"
              label={addr.type ?? "Adresse"}
              value={[addr.address, addr.postal_code, addr.city].filter(Boolean).join(", ") || "—"}
            />
          ))}
        </View>
      ) : null}

      {/* === ACCOUNT === */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <InfoRow icon="person-outline" label="Nom du compte" value={user?.name ?? "—"} />
        <InfoRow icon="at-outline" label="Email de connexion" value={user?.email ?? "—"} />
      </View>

      <View style={styles.editAction}>
        <Button
          label="Modifier mes infos"
          onPress={handleEdit}
          variant="outline"
          leftIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />}
        />
      </View>

      {/* === LOGOUT === */}
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

const styles = StyleSheet.create({
  avatarBlock: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  avatarPressable: { position: "relative", marginBottom: spacing.md },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.surface },
  avatarFallback: { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 36, fontWeight: "700", color: colors.textInverse },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: { fontSize: typography.xl, fontWeight: "700", color: colors.text, textAlign: "center" },
  code: { fontSize: typography.sm, color: colors.textMuted },
  avatarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  linkText: { color: colors.accent, fontSize: typography.sm, fontWeight: "600" },
  linkSeparator: { color: colors.textSubtle },
  linkDanger: { color: colors.danger },

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
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  infoRowText: { flex: 1 },
  infoLabel: { fontSize: typography.xs, color: colors.textMuted, fontWeight: "600" },
  infoValue: { fontSize: typography.base, color: colors.text, marginTop: 2 },

  editAction: { marginBottom: spacing.lg },
  footerActions: { marginTop: spacing.sm },
});
