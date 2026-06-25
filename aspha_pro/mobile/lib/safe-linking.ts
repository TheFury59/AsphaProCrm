import { Linking } from "react-native";

/**
 * 2026-06-24 audit M8 — Wrapper Linking.openURL avec whitelist de scheme.
 *
 * Empêche d'ouvrir un scheme arbitraire si une URL vient indirectement d'un
 * champ backend (ex : un client a renseigné un téléphone qui contient en
 * réalité `javascript:` ou `intent://`). On limite aux schemes opérationnels
 * réellement attendus par l'app.
 */
const ALLOWED_SCHEMES = ["tel:", "mailto:", "https:", "http:", "maps:", "geo:"];

export function isSchemeAllowed(url: string): boolean {
  return ALLOWED_SCHEMES.some((s) => url.toLowerCase().startsWith(s));
}

export async function safeOpenURL(url: string): Promise<boolean> {
  if (!isSchemeAllowed(url)) {
    console.warn("[safe-linking] scheme refusé :", url.slice(0, 20));
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
