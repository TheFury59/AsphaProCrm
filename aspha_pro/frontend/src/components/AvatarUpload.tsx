import { useRef, useState } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "./EntityAvatar";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Composant d'upload réutilisable pour avatar intervenant et logo client.
 *
 * Usage :
 *   <AvatarUpload
 *     type="employee" id={emp.id} src={emp.avatar_url} name={emp.name}
 *     onUpdate={() => refetch()}
 *   />
 *
 * Champ multipart : "avatar" (employee) ou "logo" (client). Le composant
 * gère l'upload + suppression + preview optimiste + invalidation cache.
 */
type Props = {
  type: "employee" | "client";
  id: number;
  src?: string | null;
  name?: string | null;
  /** Taille du cercle Avatar. Default md. */
  size?: "md" | "lg" | "xl";
  /** Appelé après upload/delete réussi (fallback si pas d'invalidation auto). */
  onUpdate?: () => void;
};

export function AvatarUpload({ type, id, src, name, size = "xl", onUpdate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Preview optimiste : on affiche immédiatement la nouvelle image
  // sans attendre le round-trip API.
  const [preview, setPreview] = useState<string | null>(null);

  const isClient = type === "client";
  const endpoint = isClient ? `/clients/${id}/logo` : `/employees/${id}/avatar`;
  const fieldName = isClient ? "logo" : "avatar";
  const label = isClient ? "logo de l'entreprise" : "photo de profil";
  const variant = isClient ? "client" : "employee";

  const invalidate = () => {
    if (isClient) {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients", id] });
    } else {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees", id] });
    }
    onUpdate?.();
  };

  const handlePick = () => fileRef.current?.click();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation côté client (le backend re-vérifie de toute façon)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 2 Mo)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image (jpg, png, webp)");
      return;
    }

    // Preview optimiste local
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const form = new FormData();
      form.append(fieldName, file);
      await api.post(endpoint, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${label.charAt(0).toUpperCase()}${label.slice(1)} mis à jour`);
      invalidate();
    } catch (err: any) {
      setPreview(null);
      const msg = err.response?.data?.message
        ?? err.response?.data?.errors?.[fieldName]?.[0]
        ?? `Erreur lors de l'upload du ${label}`;
      toast.error(msg);
    } finally {
      setUploading(false);
      // Reset l'input pour permettre de re-sélectionner le même fichier
      if (fileRef.current) fileRef.current.value = "";
      // Libère la preview locale après un délai (laisse le temps au cache de se rafraîchir)
      setTimeout(() => {
        URL.revokeObjectURL(localUrl);
        setPreview(null);
      }, 2000);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer ${label} ?`)) return;
    setDeleting(true);
    try {
      await api.delete(endpoint);
      toast.success(`${label.charAt(0).toUpperCase()}${label.slice(1)} supprimé(e)`);
      setPreview(null);
      invalidate();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const displaySrc = preview ?? src;

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <EntityAvatar src={displaySrc} name={name} variant={variant} size={size} />
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePick}
            disabled={uploading}
            className="gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            {src ? "Remplacer" : `Ajouter ${label}`}
          </Button>
          {src && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleting}
              className="text-rose-600 hover:text-rose-700 gap-1.5"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          JPG, PNG ou WebP · Max 2 Mo
        </p>
      </div>
    </div>
  );
}
