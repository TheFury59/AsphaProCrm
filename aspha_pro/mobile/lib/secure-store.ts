// Wrapper expo-secure-store pour le token Sanctum.
// Sur iOS, utilise le Keychain (chiffrement materiel) ; sur Android, l'EncryptedSharedPreferences.
// SecureStore est limite a ~2 KB par valeur — largement suffisant pour un PAT.

import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "aspha.auth.token";

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
