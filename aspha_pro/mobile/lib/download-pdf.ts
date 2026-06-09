// Download d'un PDF via l'API authentifiee + sauvegarde en cache + share natif.
//
// Pourquoi axios + base64 plutot que FileSystem.downloadAsync direct ?
//   FileSystem.downloadAsync ne passe PAS par les interceptors axios → il
//   faudrait reinjecter manuellement le Bearer token (et l'URL absolue). C'est
//   faisable mais plus fragile : si le token tourne ou l'URL change, on a deux
//   sources de verite. On prefere `api.get(..., { responseType: "arraybuffer" })`
//   qui herite de toute la config (baseURL + interceptor token + timeout).
//
// On ecrit le PDF en cache (Paths.cache equivalent : FileSystem.cacheDirectory)
// puis on declenche `Sharing.shareAsync` qui sur iOS ouvre la sheet, sur Android
// ouvre le picker (avec Quick PDF Viewer / Drive / Gmail / etc.).

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api } from "@/lib/api";

/**
 * Telecharge un PDF depuis l'endpoint donne (relatif a baseURL), l'ecrit dans
 * le cache, puis declenche le share/aper natif. Retourne le path local.
 *
 * @throws Error si l'API rejette / si on ne peut pas ecrire le fichier.
 */
export async function downloadAndSharePdf(
  endpoint: string,
  filename: string,
): Promise<string> {
  // 1) Fetch en binaire via axios (avec Bearer token automatique).
  const response = await api.get<ArrayBuffer>(endpoint, {
    responseType: "arraybuffer",
  });

  // 2) Conversion en base64 — la lib `expo-file-system/legacy` n'a pas d'API
  //    pour ecrire des bytes bruts ; on passe par EncodingType.Base64.
  const base64 = arrayBufferToBase64(response.data);

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const localUri = `${FileSystem.cacheDirectory}${safeFilename}`;

  await FileSystem.writeAsStringAsync(localUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 3) Open native share sheet (PDF viewer / Drive / Gmail / Files…).
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  }

  return localUri;
}

/**
 * Convertit un ArrayBuffer en chaine base64 sans dependance native.
 * Implementation chunk-par-chunk pour eviter le « Maximum call stack exceeded »
 * sur les gros PDFs (String.fromCharCode(...bytes) explose sur > ~100kB).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 32 KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    // String.fromCharCode prend un spread d'ints → on borne au chunkSize.
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  // globalThis.btoa existe sur React Native (Hermes) depuis longtemps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btoaFn: (s: string) => string = (globalThis as any).btoa;
  return btoaFn(binary);
}
