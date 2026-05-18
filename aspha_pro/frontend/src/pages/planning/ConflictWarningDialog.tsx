import {
  AlertTriangle, Clock, ArrowRightLeft, Undo2, Check, MapPin,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConflictItem } from "@/hooks/use-conflict-check";

/**
 * Pop-up d'avertissement quand un drag-drop crée des conflits horaires.
 *
 * Plus visible qu'un toast (décision UX du 2026-05-18 : "c'est important,
 * mets-le en pop-up"). Bloque l'interaction le temps que le user confirme
 * ou annule son déplacement.
 *
 * 2 actions possibles :
 *  - "Garder le déplacement" → ferme juste le dialog
 *  - "Annuler le déplacement" → appelle onRevert() qui remet le RDV à
 *     sa position d'origine via arg.revert() de FullCalendar
 */
type Props = {
  open: boolean;
  conflicts: ConflictItem[];
  onClose: () => void;
  /** Revert le drag-drop (remet le RDV à sa position d'origine). */
  onRevert: () => void;
};

const TYPE_META: Record<ConflictItem["type"], {
  label: string;
  icon: typeof Clock;
  color: string;
}> = {
  overlap: {
    label: "Chevauchement",
    icon: ArrowRightLeft,
    color: "text-rose-600",
  },
  travel_before: {
    label: "Trajet depuis le RDV précédent",
    icon: Clock,
    color: "text-amber-600",
  },
  travel_after: {
    label: "Trajet vers le RDV suivant",
    icon: Clock,
    color: "text-amber-600",
  },
};

export function ConflictWarningDialog({ open, conflicts, onClose, onRevert }: Props) {
  const hasError = conflicts.some((c) => c.severity === "error");
  const headerBg = hasError
    ? "bg-rose-50 dark:bg-rose-950/40"
    : "bg-amber-50 dark:bg-amber-950/40";
  const headerIcon = hasError ? "text-rose-600" : "text-amber-600";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-xl">
        <DialogHeader>
          <div className={`flex items-start gap-3 -mx-6 -mt-6 px-6 py-4 ${headerBg} border-b`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-white dark:bg-zinc-900 shadow-sm ${headerIcon}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">
                {hasError
                  ? "⚠ Conflit bloquant détecté"
                  : "⏱ Temps de trajet insuffisant"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {hasError
                  ? "Ce déplacement chevauche un autre RDV de l'intervenant — il faut choisir."
                  : "L'intervenant n'aura pas le temps de faire le trajet entre les RDV. Tu peux quand même valider si tu acceptes le retard."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
          {conflicts.map((c, i) => {
            const meta = TYPE_META[c.type];
            const Icon = meta.icon;
            return (
              <div
                key={i}
                className={
                  "rounded-lg border p-3 space-y-2 " +
                  (c.severity === "error"
                    ? "border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20"
                    : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20")
                }
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{meta.label}</span>
                      <Badge
                        variant="outline"
                        className={
                          "text-[10px] h-5 " +
                          (c.severity === "error"
                            ? "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                            : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300")
                        }
                      >
                        {c.severity === "error" ? "Bloquant" : "Avertissement"}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed mt-1">{c.message}</p>
                  </div>
                </div>

                {/* Mini-grid de stats pour les warnings de trajet */}
                {(c.type === "travel_before" || c.type === "travel_after") && c.travel_minutes !== undefined && (
                  <div className="grid grid-cols-3 gap-2 pl-7 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trajet</div>
                      <div className="font-semibold tabular-nums flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {c.travel_minutes} min
                      </div>
                    </div>
                    {c.missing_minutes !== undefined && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Retard</div>
                        <div className="font-semibold tabular-nums text-rose-600">
                          +{c.missing_minutes} min
                        </div>
                      </div>
                    )}
                    {c.other_client && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Client</div>
                        <div className="font-medium truncate" title={c.other_client}>
                          {c.other_client}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onRevert();
              onClose();
            }}
            className="gap-1.5"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Annuler le déplacement
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className={
              hasError
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Garder le déplacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
