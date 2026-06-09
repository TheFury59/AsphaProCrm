// Hooks React Query : documents intervenant (extranet self-service).
//
// Endpoints (dédiés mobile — pas les routes admin /documents) :
//   GET    /extranet/intervenant/documents                        — liste
//   POST   /extranet/intervenant/documents                        — upload (multipart)
//   GET    /extranet/intervenant/documents/{id}/download          — fichier binaire
//   DELETE /extranet/intervenant/documents/{id}                   — supprimer (uploads only)
//
// Convention de cache-key : ["intervenant-documents"]
//
// L'upload passe en multipart/form-data — il faut surcharger le Content-Type
// pour qu'axios laisse le moteur natif gérer la boundary du multipart.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ApiResponse, IntervenantDocument } from "@/types/api";

// === LIST ===
export function useIntervenantDocuments(): UseQueryResult<IntervenantDocument[], Error> {
  return useQuery<IntervenantDocument[], Error>({
    queryKey: ["intervenant-documents"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<IntervenantDocument[]>>(
        "/extranet/intervenant/documents",
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

// === UPLOAD ===
// Le picker (expo-document-picker) renvoie une URI locale (`file:///…`) ;
// on construit le FormData avec la shape RN attendue côté Laravel (le
// fichier est lu via le `name` champ « file »).
export type UploadDocumentInput = {
  uri: string;
  name: string;
  /** Mime deviné par le picker (peut être null) — fallback application/octet-stream. */
  mimeType?: string | null;
  /** Libellé visible (par défaut = nom du fichier). */
  label: string;
  /** Catégorie libre (défaut backend = `uploaded_by_employee`). */
  category?: string | null;
};

export function useUploadIntervenantDocument(): UseMutationResult<
  IntervenantDocument,
  Error,
  UploadDocumentInput
> {
  const qc = useQueryClient();
  return useMutation<IntervenantDocument, Error, UploadDocumentInput>({
    mutationFn: async (input) => {
      const formData = new FormData();
      // Pattern RN attendu par axios + Laravel : object { uri, name, type }.
      // Cf. avatar upload existant (use-intervenant-profile.ts).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formData.append("file", {
        uri: input.uri,
        name: input.name,
        type: input.mimeType ?? "application/octet-stream",
      } as any);
      formData.append("label", input.label);
      if (input.category) {
        formData.append("category", input.category);
      }

      const { data } = await api.post<ApiResponse<IntervenantDocument>>(
        "/extranet/intervenant/documents",
        formData,
        {
          headers: {
            // ⚠️ Laisser axios poser la boundary lui-même : passer
            // `multipart/form-data` SANS boundary, fetch/RN s'en chargent.
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intervenant-documents"] });
    },
  });
}

// === DELETE ===
export function useDeleteIntervenantDocument(): UseMutationResult<
  void,
  Error,
  number
> {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (documentId) => {
      await api.delete(`/extranet/intervenant/documents/${documentId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["intervenant-documents"] });
    },
  });
}

// === Helpers UI ===

/** Format human-readable d'une taille en Ko (renvoyée par le backend). */
export function formatFileSize(sizeKb: number | null): string {
  if (sizeKb == null) return "";
  if (sizeKb < 1024) return `${sizeKb} Ko`;
  const mb = sizeKb / 1024;
  return `${mb.toFixed(1)} Mo`;
}

/** Icône Ionicons à afficher selon le mime_type / extension. */
export function getFileIcon(
  mimeType: string | null,
  label?: string,
): "document-text-outline" | "image-outline" | "document-outline" {
  if (!mimeType && label) {
    const ext = label.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "document-text-outline";
    if (["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) return "image-outline";
    if (["doc", "docx"].includes(ext ?? "")) return "document-outline";
    return "document-outline";
  }
  if (!mimeType) return "document-outline";
  if (mimeType === "application/pdf") return "document-text-outline";
  if (mimeType.startsWith("image/")) return "image-outline";
  if (mimeType.includes("word") || mimeType.includes("officedocument")) return "document-outline";
  return "document-outline";
}

/**
 * Groupe les documents par catégorie pour l'affichage en sections.
 * Les uploads self-service (`uploaded_by_employee`) sont regroupés à part.
 */
export function groupDocumentsByCategory(
  docs: IntervenantDocument[],
): { title: string; data: IntervenantDocument[] }[] {
  const buckets = new Map<string, IntervenantDocument[]>();
  for (const d of docs) {
    const key = d.category ?? d.document_type ?? "other";
    const arr = buckets.get(key) ?? [];
    arr.push(d);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([key, data]) => ({
    title: categoryLabel(key),
    data,
  }));
}

function categoryLabel(key: string): string {
  switch (key) {
    case "uploaded_by_employee":
      return "Mes documents";
    case "contract":
      return "Contrats";
    case "payslip":
      return "Fiches de paie";
    case "insurance":
      return "Attestations / assurances";
    case "product_sheet":
      return "Fiches produits";
    case "protocol":
      return "Protocoles";
    case "other":
      return "Autres documents";
    default:
      return key;
  }
}
