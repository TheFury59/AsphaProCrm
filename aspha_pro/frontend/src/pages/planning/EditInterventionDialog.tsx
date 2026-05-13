import { useState } from "react";
import { Sparkles, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useUpdateIntervention, useDeleteIntervention } from "@/hooks/use-phase3";
import { useCreateInterventionException } from "@/hooks/use-payments";
import { apiErrorMessage } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  a_pourvoir: "À pourvoir",
  planifiee: "Planifiée",
  realisee: "Terminée",
  annulee: "Annulée",
  draft: "Brouillon",
  terminated: "Terminée",
};

/**
 * Convertit une Date / string en valeur de champ datetime-local "YYYY-MM-DDTHH:mm".
 */
function toDatetimeLocal(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Dialog d'ÉDITION d'un RDV existant.
 *
 * Gère 3 cas :
 *  1. Intervention ponctuelle (non récurrente, non exception)
 *     → édition directe du record (PATCH /interventions/{id})
 *
 *  2. Occurrence virtuelle d'une récurrence (is_occurrence: true)
 *     → on ne peut pas modifier la "ligne" car elle n'existe pas en BDD,
 *       il faut créer une EXCEPTION sur la série parent pour cette date précise.
 *       L'exception devient un record concret avec ses propres horaires/statut.
 *
 *  3. Exception (is_exception: true, non récurrente, parent_id défini)
 *     → édition directe (PATCH du record exception)
 *
 * Dans tous les cas l'UI est la même : on édite intervenant, statut, horaires,
 * commentaire. Côté soumission on choisit la bonne route.
 */
export function EditInterventionDialog({
  intervention, employees, onClose, onSuggest, onDeleted,
}: {
  intervention: any;
  employees: any[];
  onClose: () => void;
  onSuggest: () => void;
  onDeleted: () => void;
}) {
  const update = useUpdateIntervention();
  const del = useDeleteIntervention();
  const createException = useCreateInterventionException();

  const [form, setForm] = useState({
    employee_id: intervention.employee?.id ? String(intervention.employee.id) : "",
    status: intervention.status ?? "planifiee",
    start_datetime: toDatetimeLocal(intervention.start_datetime),
    end_datetime: toDatetimeLocal(intervention.end_datetime),
    comment: intervention.comment ?? "",
  });

  const isOccurrence = !!intervention.is_occurrence;
  const isException = !!intervention.is_exception;
  const isRecurring = !!intervention.is_recurring;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      employee_id: form.employee_id ? parseInt(form.employee_id, 10) : null,
      status: form.status,
      start_datetime: form.start_datetime + ":00",  // ajoute les secondes
      end_datetime: form.end_datetime + ":00",
      comment: form.comment || null,
    };

    if (isOccurrence) {
      // Cas 2 : on crée une exception sur la série
      createException.mutate({
        parentId: intervention.intervention_id,
        payload: {
          exception_date: intervention.occurrence_date,
          start_datetime: form.start_datetime + ":00",
          end_datetime: form.end_datetime + ":00",
          employee_id: payload.employee_id,
          status: form.status,
          comment: form.comment || null,
        },
      }, {
        onSuccess: () => { toast.success("Exception créée pour cette occurrence"); onClose(); },
        onError: (err) => toast.error(apiErrorMessage(err)),
      });
    } else {
      // Cas 1 et 3 : update direct
      update.mutate({ id: intervention.intervention_id, patch: payload }, {
        onSuccess: () => { toast.success("Intervention modifiée"); onClose(); },
        onError: (err) => toast.error(apiErrorMessage(err)),
      });
    }
  };

  const handleDelete = () => {
    const msg = isOccurrence
      ? "Supprimer toute la série de récurrences ? Toutes les futures occurrences disparaîtront."
      : isException
        ? "Supprimer cette exception ? L'occurrence d'origine de la série réapparaîtra."
        : "Supprimer cette intervention ? Cette action est définitive.";
    if (!confirm(msg)) return;
    del.mutate(intervention.intervention_id, {
      onSuccess: () => { toast.success("Supprimé"); onDeleted(); },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier le RDV — {intervention.client?.company_name ?? intervention.client?.code ?? "Client"}
          </DialogTitle>
          <DialogDescription>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {isRecurring && !isException && <Badge variant="secondary">Série récurrente</Badge>}
              {isOccurrence && <Badge variant="outline">Occurrence virtuelle</Badge>}
              {isException && <Badge variant="outline">Exception</Badge>}
              <Badge>{STATUS_LABELS[intervention.status] ?? intervention.status}</Badge>
            </div>
            {isOccurrence && (
              <p className="mt-2 text-xs">
                ⚠️ Modifier cette occurrence créera une <strong>exception</strong> sur la série.
                Les autres occurrences resteront inchangées.
              </p>
            )}
            {isRecurring && !isOccurrence && !isException && (
              <p className="mt-2 text-xs">
                ⚠️ Cette intervention est la <strong>règle de la série</strong>. Toute modification
                affectera toutes les futures occurrences.
              </p>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Intervenant</Label>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
            >
              <option value="">À pourvoir</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Statut</Label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
            >
              <option value="a_pourvoir">À pourvoir</option>
              <option value="planifiee">Planifiée</option>
              <option value="realisee">Terminée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Début</Label>
              <Input
                type="datetime-local"
                value={form.start_datetime}
                onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Input
                type="datetime-local"
                value={form.end_datetime}
                onChange={(e) => setForm({ ...form, end_datetime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea
              rows={2}
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Observations administrateur…"
            />
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="default" size="sm" onClick={onSuggest}>
              <Sparkles className="mr-1.5 h-3 w-3" />
              Suggérer
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1.5 h-3 w-3" />
              {isOccurrence ? "Supprimer la série" : "Supprimer"}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={update.isPending || createException.isPending}>
                <Save className="mr-1.5 h-3 w-3" />
                Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
