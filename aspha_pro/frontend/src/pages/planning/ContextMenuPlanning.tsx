import { useEffect, useRef } from "react";
import { Calendar as CalIcon, Repeat, UserX, Ban } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Menu contextuel custom (sans Radix ContextMenu pour pouvoir le positionner
 * librement sur le clic droit FullCalendar). 4 actions principales.
 *
 * Auto-close au clic extérieur + Escape.
 */
export function ContextMenuPlanning({
  x, y, date, onAction, onClose,
}: {
  x: number;
  y: number;
  date: Date;
  onAction: (mode: "ponctuel" | "recurrent" | "absence" | "indispo") => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp position pour ne pas sortir
  const safeX = Math.min(x, window.innerWidth - 240);
  const safeY = Math.min(y, window.innerHeight - 220);

  const items = [
    { id: "ponctuel", label: "Intervention ponctuelle", icon: CalIcon, hint: "Un seul RDV" },
    { id: "recurrent", label: "Intervention récurrente", icon: Repeat, hint: "Quotidien / Hebdo / Mensuel" },
    { id: "absence", label: "Absence intervenant", icon: UserX, hint: "Congés, maladie, formation…" },
    { id: "indispo", label: "Indisponibilité client", icon: Ban, hint: "Le client n'est pas dispo" },
  ] as const;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-60 rounded-lg border bg-popover shadow-xl py-1"
      style={{ left: safeX, top: safeY }}
    >
      <div className="px-3 py-1.5 border-b text-[10px] uppercase tracking-wide text-muted-foreground">
        {format(date, "EEEE d MMMM yyyy HH:mm", { locale: fr })}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => { onAction(item.id as any); onClose(); }}
            className="w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
          >
            <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
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
