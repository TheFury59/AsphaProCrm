import { useEffect, useRef } from "react";
import { Pencil, Sparkles, Trash2, Ban } from "lucide-react";

/**
 * Menu contextuel affiché au clic droit sur un RDV existant.
 *
 * Actions :
 *  - Modifier le RDV → ouvre le dialog détail (selected)
 *  - Suggérer un intervenant → ouvre le matching dialog
 *  - Annuler le RDV (status → annulee)
 *  - Supprimer (avec confirmation, et "toute la série" si occurrence)
 */
export function ContextMenuEvent({
  x, y, intervention, onAction, onClose,
}: {
  x: number;
  y: number;
  intervention: any;
  onAction: (action: "edit" | "match" | "delete" | "cancel") => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const safeX = Math.min(x, window.innerWidth - 240);
  const safeY = Math.min(y, window.innerHeight - 220);

  const start = new Date(intervention.start_datetime);
  const items = [
    { id: "edit", label: "Modifier le RDV", icon: Pencil, hint: "Détails + horaires + intervenant" },
    { id: "match", label: "Suggérer un intervenant", icon: Sparkles, hint: "Top candidats triés" },
    { id: "cancel", label: "Annuler le RDV", icon: Ban, hint: "Passe en statut Annulée", danger: false },
    { id: "delete", label: intervention.is_occurrence ? "Supprimer la série" : "Supprimer", icon: Trash2, hint: "Définitif", danger: true },
  ] as const;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border bg-popover shadow-xl py-1"
      style={{ left: safeX, top: safeY }}
    >
      <div className="px-3 py-1.5 border-b">
        <div className="text-xs font-medium truncate">
          {intervention.client?.company_name ?? intervention.client?.code ?? "RDV"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à{" "}
          {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          {intervention.employee?.name && ` · ${intervention.employee.name}`}
        </div>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onAction(item.id as any)}
            className={`w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-accent text-left ${item.danger ? "text-destructive hover:bg-destructive/10" : ""}`}
          >
            <Icon className={`h-3.5 w-3.5 mt-0.5 ${item.danger ? "text-destructive" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <div className="font-medium">{item.label}</div>
              <div className="text-[10px] text-muted-foreground">{item.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
