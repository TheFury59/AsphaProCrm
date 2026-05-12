import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string | null | undefined;
  onSave: (newValue: string | null) => Promise<void>;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "email" | "tel" | "number";
  mono?: boolean;
  readonly?: boolean;
};

/**
 * Champ éditable inline : click pour passer en édition, Entrée ou blur pour valider,
 * Escape pour annuler. Sauvegarde via la prop onSave (async).
 */
export function EditableField({
  value, onSave, label, placeholder, multiline = false, type = "text", mono = false, readonly = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }
  }, [editing]);

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;
    if (draft === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft.trim() === "" ? null : draft.trim());
      setEditing(false);
    } catch {
      // erreur silencieuse : la valeur affichée reste l'ancienne (pas modifiée par le parent)
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      void save();
    }
  };

  if (readonly) {
    return (
      <span className={mono ? "font-mono text-xs" : ""}>
        {value || <span className="text-muted-foreground/50">—</span>}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`group inline-flex items-center gap-1.5 rounded hover:bg-accent/50 px-1 -mx-1 text-left transition-colors w-full ${mono ? "font-mono text-xs" : ""}`}
        title={label ? `Cliquer pour modifier ${label.toLowerCase()}` : "Cliquer pour modifier"}
      >
        <span className="flex-1">
          {value || <span className="text-muted-foreground/50">— Cliquer pour saisir</span>}
        </span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
      </button>
    );
  }

  const InputComp = multiline ? Textarea : Input;

  return (
    <div className="inline-flex items-center gap-1 w-full">
      <InputComp
        ref={inputRef as any}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={save}
        placeholder={placeholder ?? label}
        disabled={saving}
        rows={multiline ? 3 : undefined}
        className={`flex-1 ${mono ? "font-mono text-xs" : ""}`}
      />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); void save(); }}
        disabled={saving}
        className="p-1 rounded text-primary hover:bg-primary/10"
        title="Valider (Entrée)"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); cancel(); }}
        className="p-1 rounded text-muted-foreground hover:bg-accent"
        title="Annuler (Échap)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
