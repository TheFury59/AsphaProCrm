import { useState } from "react";
import { Plus, Pencil, Trash2, FileSignature } from "lucide-react";
import { toast } from "sonner";
import {
  useClientContracts, useCreateClientContract,
  useUpdateClientContract, useDeleteClientContract,
  type ClientContract,
} from "@/hooks/use-sub-resources";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm";

// Normalise une date reçue de l'API en `YYYY-MM-DD` pour l'<input type=date>.
// JAMAIS `new Date()` qui re-décale le fuseau (cf. lessons.md 2026-05-21).
function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : "";
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  ended: "Terminé",
  cancelled: "Résilié",
};

type ContractForm = {
  type: string;
  start_date: string;
  end_date: string;
  commitment_duration: string;
  billing_rhythm: string;
  tacit_renewal: boolean;
  status: string;
  notes: string;
};

function emptyForm(): ContractForm {
  return {
    type: "",
    start_date: "",
    end_date: "",
    commitment_duration: "",
    billing_rhythm: "",
    tacit_renewal: false,
    status: "active",
    notes: "",
  };
}

function toForm(c: ClientContract): ContractForm {
  return {
    type: c.type ?? "",
    start_date: toDateInput(c.start_date),
    end_date: toDateInput(c.end_date),
    commitment_duration: c.commitment_duration ?? "",
    billing_rhythm: c.billing_rhythm ?? "",
    tacit_renewal: !!c.tacit_renewal,
    status: c.status ?? "active",
    notes: c.notes ?? "",
  };
}

export function ClientContractsTab({ clientId }: { clientId: number }) {
  const { data: contracts = [] } = useClientContracts(clientId);
  const create = useCreateClientContract(clientId);
  const update = useUpdateClientContract(clientId);
  const del = useDeleteClientContract(clientId);

  // null = fermé · "new" = création · objet = édition
  const [editing, setEditing] = useState<ClientContract | "new" | null>(null);

  const handleDelete = async (c: ClientContract) => {
    if (!(await confirm({ title: "Supprimer le contrat", description: `Supprimer le contrat ${c.reference ?? "#" + c.id} ?`, confirmLabel: "Supprimer", variant: "danger" }))) return;
    try {
      await del.mutateAsync(c.id);
      toast.success("Contrat supprimé");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Suppression impossible"));
      console.error("Suppression contrat client échouée", e);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Contrats</CardTitle>
          <CardDescription>
            Contrats de prestation du client (engagement, facturation, reconduction)
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau contrat
        </Button>
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            <FileSignature className="h-9 w-9 mx-auto mb-2 opacity-30" />
            Aucun contrat enregistré pour ce client.
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {contracts.map((c) => (
              <li key={c.id} className="flex items-start justify-between border rounded p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">{c.reference ?? `#${c.id}`}</span>
                    {c.type && <span className="font-medium">{c.type}</span>}
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                    {c.tacit_renewal && (
                      <Badge variant="outline" className="text-xs">Reconduction tacite</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    {(c.start_date || c.end_date) && (
                      <span>
                        {toDateInput(c.start_date) || "?"} → {toDateInput(c.end_date) || "—"}
                      </span>
                    )}
                    {c.commitment_duration && <span>Engagement : {c.commitment_duration}</span>}
                    {c.billing_rhythm && <span>Facturation : {c.billing_rhythm}</span>}
                  </div>
                  {c.notes && (
                    <div className="text-xs text-muted-foreground whitespace-pre-line">{c.notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-destructive hover:bg-destructive/10 p-2 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {editing !== null && (
        <ContractFormDialog
          key={editing === "new" ? "new" : editing.id}
          contract={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            if (editing === "new") {
              await create.mutateAsync(form);
            } else {
              await update.mutateAsync({ id: editing.id, patch: form });
            }
          }}
          isPending={create.isPending || update.isPending}
        />
      )}
    </Card>
  );
}

function ContractFormDialog({
  contract,
  onClose,
  onSubmit,
  isPending,
}: {
  contract: ClientContract | null;
  onClose: () => void;
  onSubmit: (form: Partial<ClientContract>) => Promise<void>;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ContractForm>(contract ? toForm(contract) : emptyForm());

  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation métier au clic (pas de submit disabled métier).
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error("La date de fin doit suivre la date de début.");
      return;
    }
    try {
      await onSubmit({
        type: form.type.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        commitment_duration: form.commitment_duration.trim() || null,
        billing_rhythm: form.billing_rhythm.trim() || null,
        tacit_renewal: form.tacit_renewal,
        status: form.status,
        notes: form.notes.trim() || null,
      });
      toast.success(contract ? "Contrat mis à jour" : "Contrat créé");
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Enregistrement impossible"));
      console.error("Enregistrement contrat client échoué", err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contract ? "Modifier le contrat" : "Nouveau contrat"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {contract && (
            <p className="text-xs text-muted-foreground">
              Référence : <span className="font-mono">{contract.reference ?? `#${contract.id}`}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Type de contrat</Label>
            <Input
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              placeholder="Ex. Ménage régulier, Contrat-cadre…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Durée d'engagement</Label>
              <Input
                value={form.commitment_duration}
                onChange={(e) => set("commitment_duration", e.target.value)}
                placeholder="Ex. 12 mois"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rythme de facturation</Label>
              <Input
                value={form.billing_rhythm}
                onChange={(e) => set("billing_rhythm", e.target.value)}
                placeholder="Ex. Mensuel"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Statut</Label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
            >
              <option value="active">Actif</option>
              <option value="pending">En attente</option>
              <option value="ended">Terminé</option>
              <option value="cancelled">Résilié</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.tacit_renewal}
              onChange={(e) => set("tacit_renewal", e.target.checked)}
            />
            Reconduction tacite
          </label>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Conditions particulières, remarques…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {contract ? "Enregistrer" : "Créer le contrat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
