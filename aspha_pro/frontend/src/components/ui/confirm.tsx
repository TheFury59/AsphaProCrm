import { create } from "zustand";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Système de confirmation thémé (remplace window.confirm natif).
 *
 * Usage :
 *   import { confirm } from "@/components/ui/confirm";
 *   if (!(await confirm("Supprimer cet élément ?"))) return;
 *   // ou
 *   const ok = await confirm({
 *     title: "Supprimer la facture",
 *     description: "Cette action est irréversible.",
 *     confirmLabel: "Supprimer",
 *     variant: "danger",
 *   });
 *
 * Le <ConfirmDialog /> est monté UNE fois au niveau racine (App.tsx).
 */
type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` colore le bouton de confirmation en rouge (suppressions). */
  variant?: "default" | "danger";
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((v: boolean) => void) | null;
  request: (o: ConfirmOptions) => Promise<boolean>;
  close: (v: boolean) => void;
};

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: {},
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    }),
  close: (v) => {
    const r = get().resolve;
    set({ open: false, resolve: null });
    r?.(v);
  },
}));

/**
 * Ouvre la boîte de confirmation et renvoie une promesse `true`/`false`.
 * Accepte soit une string (juste la description), soit un objet d'options.
 */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { description: options } : options;
  return useConfirmStore.getState().request(opts);
}

export function ConfirmDialog() {
  const { open, options, close } = useConfirmStore();
  const isDanger = options.variant === "danger";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDanger && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
            {options.title ?? "Confirmer"}
          </DialogTitle>
          {options.description && (
            <DialogDescription className="whitespace-pre-line pt-1 text-sm">
              {options.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => close(false)} className="cursor-pointer">
            {options.cancelLabel ?? "Annuler"}
          </Button>
          <Button
            variant={isDanger ? "destructive" : "default"}
            onClick={() => close(true)}
            className="cursor-pointer"
            autoFocus
          >
            {options.confirmLabel ?? "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
