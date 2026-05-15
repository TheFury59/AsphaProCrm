import { useState } from "react";
import { Sparkles, Trash2, Save, KeyRound, CheckCircle, Car, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useUpdateIntervention, useDeleteIntervention } from "@/hooks/use-phase3";
import { useCreateInterventionException } from "@/hooks/use-payments";
import { api, apiErrorMessage } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  a_pourvoir: "À pourvoir",
  planifiee: "Planifiée",
  realisee: "Terminée",
  annulee: "Annulée",
  draft: "Brouillon",
  terminated: "Terminée",
};

/**
 * Splits une string ISO en {date, time} pour les inputs séparés.
 */
function splitDateTime(value: string | Date): { date: string; time: string } {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Dialog d'ÉDITION complet d'un RDV existant.
 *
 * Gère 3 cas :
 *  1. Intervention ponctuelle → PATCH direct
 *  2. Occurrence virtuelle d'une récurrence → POST /exceptions
 *  3. Exception déjà existante → PATCH direct
 *
 * Champs éditables (organisation en 2 colonnes lg+) :
 *  Col 1 : intervenant, statut, dates+heures séparées
 *  Col 2 : clé client, transport, véhicule, flags facturation/paiement
 *  Pleine largeur : commentaires (admin + interne)
 *
 * Actions :
 *  - Suggérer (matching auto)
 *  - Supprimer / Supprimer la série
 *  - Valider le badge manuellement (si RDV passé sans checkin)
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

  const start = splitDateTime(intervention.start_datetime);
  const end = splitDateTime(intervention.end_datetime);

  const [form, setForm] = useState({
    employee_id: intervention.employee?.id ? String(intervention.employee.id) : "",
    status: intervention.status ?? "planifiee",
    start_date: start.date,
    start_time: start.time,
    end_date: end.date,
    end_time: end.time,
    key_id: intervention.key_id ? String(intervention.key_id) : "",
    address_id: intervention.address_id ? String(intervention.address_id) : "",
    contact_id: intervention.contact_id ? String(intervention.contact_id) : "",
    transport_mode: intervention.transport_mode ?? "",
    vehicle_type: intervention.vehicle_type ?? "",
    bill_client: intervention.bill_client ?? true,
    is_paid: intervention.is_paid ?? true,
    comment: intervention.comment ?? "",
    internal_comment: intervention.internal_comment ?? "",
  });

  const isOccurrence = !!intervention.is_occurrence;
  const isException = !!intervention.is_exception;
  const isRecurring = !!intervention.is_recurring;
  const clientKeys: Array<{ id: number; label: string }> = intervention.client_keys ?? [];
  const clientAddresses: Array<{ id: number; type: string; address: string | null; city: string | null }> =
    intervention.client?.all_addresses ?? [];
  const clientContacts: Array<{ id: number; first_name: string | null; last_name: string | null; phone: string | null; email: string | null }> =
    intervention.client?.all_contacts ?? [];

  // RDV passé sans checkin → permet de valider manuellement le badgeage
  const startDt = new Date(intervention.start_datetime);
  const isPast = startDt < new Date();
  const hasCheckin = !!intervention.checkin?.checkin_time;
  const canValidateBadge = isPast && !hasCheckin && !isOccurrence;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const startDatetime = `${form.start_date}T${form.start_time}:00`;
    const endDatetime = `${form.end_date}T${form.end_time}:00`;

    const payload: any = {
      employee_id: form.employee_id ? parseInt(form.employee_id, 10) : null,
      status: form.status,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      key_id: form.key_id ? parseInt(form.key_id, 10) : null,
      address_id: form.address_id ? parseInt(form.address_id, 10) : null,
      contact_id: form.contact_id ? parseInt(form.contact_id, 10) : null,
      transport_mode: form.transport_mode || null,
      vehicle_type: form.vehicle_type || null,
      bill_client: form.bill_client,
      is_paid: form.is_paid,
      comment: form.comment || null,
      internal_comment: form.internal_comment || null,
    };

    if (isOccurrence) {
      createException.mutate({
        parentId: intervention.intervention_id,
        payload: {
          exception_date: intervention.occurrence_date,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          employee_id: payload.employee_id,
          status: form.status,
          comment: form.comment || null,
        },
      }, {
        onSuccess: () => { toast.success("Exception créée pour cette occurrence"); onClose(); },
        onError: (err) => toast.error(apiErrorMessage(err)),
      });
    } else {
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

  const handleValidateBadge = async () => {
    const reason = prompt(
      "Motif de la saisie manuelle (obligatoire) :",
      "Validation administrative — oubli badgeage",
    );
    if (!reason) return;
    try {
      await api.post("/telemanagement/manual-entry", {
        intervention_id: intervention.intervention_id,
        action: "in",
        scanned_at: `${form.start_date}T${form.start_time}:00`,
        reason,
      });
      toast.success("Badgeage validé manuellement");
      onClose();  // ferme le dialog, la query sera invalidée par les observers
    } catch (e: any) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[96vw] sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Modifier le RDV — {intervention.client?.company_name ?? intervention.client?.code ?? "Client"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 mt-2">
              <div className="flex flex-wrap gap-1.5">
                {isRecurring && !isException && <Badge variant="secondary">Série récurrente</Badge>}
                {isOccurrence && <Badge variant="outline">Occurrence virtuelle</Badge>}
                {isException && <Badge variant="outline">Exception</Badge>}
                <Badge>{STATUS_LABELS[intervention.status] ?? intervention.status}</Badge>
                {hasCheckin && (
                  <Badge className="bg-emerald-500 text-white border-0">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Badgé
                  </Badge>
                )}
              </div>
              {isOccurrence && (
                <p className="text-xs">
                  ⚠️ Modifier cette occurrence créera une <strong>exception</strong> sur la série.
                </p>
              )}
              {isRecurring && !isOccurrence && !isException && (
                <p className="text-xs">
                  ⚠️ Cette intervention est la <strong>règle de la série</strong>.
                  Toute modification affectera toutes les futures occurrences.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ===== COLONNE GAUCHE ===== */}
            <div className="space-y-3">
              {/* Intervenant */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Intervenant</Label>
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer"
                >
                  <option value="">À pourvoir</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Statut */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Statut</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer"
                >
                  <option value="a_pourvoir">À pourvoir</option>
                  <option value="planifiee">Planifiée</option>
                  <option value="realisee">Terminée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>

              {/* Début (date + heure séparées) */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Début</Label>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    required
                  />
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Fin (date + heure séparées) */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fin</Label>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <Input
                    type="date"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    required
                  />
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* ===== COLONNE DROITE ===== */}
            <div className="space-y-3">
              {/* Clé du client */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <KeyRound className="h-3 w-3" />
                  Clé à utiliser
                </Label>
                {clientKeys.length === 0 ? (
                  <div className="text-xs italic text-muted-foreground bg-muted/40 rounded-md p-2.5">
                    Ce client n'a pas de clé enregistrée. Ajouter une clé depuis la fiche client → onglet Clés.
                  </div>
                ) : (
                  <select
                    value={form.key_id}
                    onChange={(e) => setForm({ ...form, key_id: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer"
                  >
                    <option value="">— Aucune clé —</option>
                    {clientKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        🔑 {k.label}{(k as any).current_holder ? ` (chez ${(k as any).current_holder})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Adresse spécifique (si client en a plusieurs) */}
              {clientAddresses.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Adresse d'intervention
                  </Label>
                  <select
                    value={form.address_id}
                    onChange={(e) => setForm({ ...form, address_id: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer"
                  >
                    <option value="">Adresse par défaut du client</option>
                    {clientAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.type}] {a.address}{a.city ? ` — ${a.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contact spécifique (si client en a au moins 1) */}
              {clientContacts.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Contact à joindre
                  </Label>
                  <select
                    value={form.contact_id}
                    onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer"
                  >
                    <option value="">Contact société par défaut</option>
                    {clientContacts.map((c) => {
                      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(sans nom)";
                      const info = [c.phone, c.email].filter(Boolean).join(" · ");
                      return (
                        <option key={c.id} value={c.id}>
                          {name}{info ? ` — ${info}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Mode transport + Type véhicule */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    Transport
                  </Label>
                  <select
                    value={form.transport_mode}
                    onChange={(e) => setForm({ ...form, transport_mode: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer"
                  >
                    <option value="">—</option>
                    <option value="car">Voiture</option>
                    <option value="bike">Vélo</option>
                    <option value="walk">À pied</option>
                    <option value="transit">Transports</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Véhicule</Label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                    disabled={form.transport_mode !== "car"}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer disabled:opacity-50"
                  >
                    <option value="">—</option>
                    <option value="personal">Perso</option>
                    <option value="company">Société</option>
                  </select>
                </div>
              </div>

              {/* Flags facturation / paiement */}
              <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Facturation</Label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox
                    checked={form.bill_client}
                    onCheckedChange={(v) => setForm({ ...form, bill_client: v === true })}
                  />
                  <span className="font-medium">Facturer au client</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox
                    checked={form.is_paid}
                    onCheckedChange={(v) => setForm({ ...form, is_paid: v === true })}
                  />
                  <span className="font-medium">Payer l'intervenant</span>
                </label>
                {intervention.is_billed && (
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 pt-1">
                    ✓ Déjà incluse dans une facture
                  </div>
                )}
              </div>

              {/* Valider badge manuellement */}
              {canValidateBadge && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  onClick={handleValidateBadge}
                >
                  <CheckCircle className="mr-1.5 h-3 w-3" />
                  Valider le badgeage manuellement
                </Button>
              )}
            </div>
          </div>

          {/* Commentaires pleine largeur */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Commentaire admin</Label>
              <Textarea
                rows={2}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Notes visibles par tous les admins…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Note interne</Label>
              <Textarea
                rows={2}
                value={form.internal_comment}
                onChange={(e) => setForm({ ...form, internal_comment: e.target.value })}
                placeholder="Note privée (non visible client/intervenant)…"
              />
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2 pt-3 border-t">
            <Button type="button" variant="default" size="sm" onClick={onSuggest}>
              <Sparkles className="mr-1.5 h-3 w-3" />
              Suggérer un intervenant
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1.5 h-3 w-3" />
              {isOccurrence ? "Supprimer la série" : "Supprimer"}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                type="submit"
                disabled={update.isPending || createException.isPending}
                className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
              >
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
