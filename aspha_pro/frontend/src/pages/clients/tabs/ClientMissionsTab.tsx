import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Briefcase, Plus, ChevronDown, ChevronRight, Trash2,
  Package, FileText, MoreHorizontal, Repeat, Lock, Clock, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useClientMissions, useDeleteMission,
  useCreatePrestation, useDeletePrestation,
  type Mission, type Prestation, type MissionStatus,
} from "@/hooks/use-missions";
import { useProducts } from "@/hooks/use-products";
import { confirm } from "@/components/ui/confirm";

/**
 * Onglet "Missions & prestations" — hiérarchie métier :
 *   Client → 1..N Missions → 1..N Prestations contractualisées → Devis
 *
 * Une Mission = un contrat de service (ex: "Ménage hebdo M. Dupont")
 * Une Prestation = une ligne facturable (ex: "Repassage 2h", "Vitres forfait")
 */
export function ClientMissionsTab({ clientId }: { clientId: number }) {
  const { data: missions = [], isLoading } = useClientMissions(clientId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Missions du client ({missions.length})
        </CardTitle>
        <Link to={`/clients/${clientId}/missions/new`}>
          <Button size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Nouvelle mission
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-3 space-y-2">
        {isLoading && [...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}

        {!isLoading && missions.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Aucune mission enregistrée pour ce client.
            <div className="text-xs mt-1">
              Crée une mission pour commencer à contractualiser des prestations.
            </div>
          </div>
        )}

        {missions.map((mission) => (
          <MissionCard key={mission.id} mission={mission} clientId={clientId} />
        ))}
      </CardContent>
    </Card>
  );
}

// =========================================================================
// MISSION CARD (expandable, with nested prestations)
// =========================================================================

const STATUS_COLORS: Record<MissionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const STATUS_LABELS: Record<MissionStatus, string> = {
  active: "Active",
  suspended: "Suspendue",
  cancelled: "Annulée",
};

function MissionCard({ mission, clientId }: { mission: Mission; clientId: number }) {
  const [expanded, setExpanded] = useState(true);
  const [addPrestaOpen, setAddPrestaOpen] = useState(false);
  const deleteMission = useDeleteMission(clientId);

  const prestations = mission.client_prestations ?? [];
  const activeCount = prestations.filter((p) => !p.end_date).length;

  const handleDelete = async () => {
    if (!(await confirm({ title: "Supprimer la mission", description: `Supprimer la mission "${mission.name}" ?`, confirmLabel: "Supprimer", variant: "danger" }))) return;
    try {
      await deleteMission.mutateAsync(mission.id);
      toast.success("Mission supprimée");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Suppression impossible");
    }
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header mission */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left hover:opacity-80"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Briefcase className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-semibold">{mission.name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <span>{prestations.length} prestation{prestations.length > 1 ? "s" : ""}</span>
              {activeCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600">{activeCount} active{activeCount > 1 ? "s" : ""}</span>
                </>
              )}
              {mission.billing_rhythm && (
                <>
                  <span>•</span>
                  <span>{mission.billing_rhythm}</span>
                </>
              )}
              {mission.quote?.reference && (
                <>
                  <span>•</span>
                  <span className="font-mono">{mission.quote.reference}</span>
                </>
              )}
            </div>
          </div>
        </button>

        <Badge className={STATUS_COLORS[mission.status]}>{STATUS_LABELS[mission.status]}</Badge>

        <Link to={`/clients/${clientId}/missions/${mission.id}`}>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
            <Pencil className="h-3 w-3" />
            Modifier
          </Button>
        </Link>

        <Dialog open={addPrestaOpen} onOpenChange={setAddPrestaOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" />
              Prestation
            </Button>
          </DialogTrigger>
          <AddPrestationDialog
            missionId={mission.id}
            clientId={clientId}
            onClose={() => setAddPrestaOpen(false)}
          />
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/clients/${clientId}/missions/${mission.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Modifier la mission
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-rose-600">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Supprimer la mission
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Prestations imbriquées */}
      {expanded && (
        <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
          {prestations.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-4">
              Aucune prestation. Clique sur "Prestation" pour en ajouter.
            </div>
          )}
          {prestations.map((p) => (
            <PrestationRow
              key={p.id}
              prestation={p}
              missionId={mission.id}
              clientId={clientId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// PRESTATION ROW
// =========================================================================

function PrestationRow({
  prestation,
  missionId,
  clientId,
}: {
  prestation: Prestation;
  missionId: number;
  clientId: number;
}) {
  const deletePresta = useDeletePrestation(missionId, clientId);

  const price = Number(prestation.custom_price ?? prestation.base_price ?? 0);
  const isActive = !prestation.end_date;

  const handleDelete = async () => {
    if (!(await confirm({ title: "Supprimer la prestation", description: `Supprimer la prestation "${prestation.label}" ?`, confirmLabel: "Supprimer", variant: "danger" }))) return;
    try {
      await deletePresta.mutateAsync(prestation.id);
      toast.success("Prestation supprimée");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Suppression impossible");
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border text-xs">
      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{prestation.label}</div>
        {prestation.product?.name && prestation.product.name !== prestation.label && (
          <div className="text-[10px] text-muted-foreground font-mono truncate">
            {prestation.product.code} · {prestation.product.name}
          </div>
        )}
      </div>

      {prestation.nature === "regular" ? (
        <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 h-5 text-[10px] gap-0.5">
          <Repeat className="h-2.5 w-2.5" /> Récurrente
        </Badge>
      ) : (
        <Badge variant="secondary" className="h-5 text-[10px]">Ponctuelle</Badge>
      )}

      {prestation.billing_type && (
        <Badge variant="outline" className="text-[10px] h-5">{prestation.billing_type}</Badge>
      )}

      <div className="text-right tabular-nums shrink-0">
        <div className="font-semibold">{price.toFixed(2)} €</div>
        {prestation.pricing_type === "custom" && (
          <div className="text-[9px] text-amber-600">prix custom</div>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground shrink-0 w-20 text-right">
        {prestation.start_date && format(new Date(prestation.start_date), "dd/MM/yy", { locale: fr })}
        {prestation.end_date && (
          <> → {format(new Date(prestation.end_date), "dd/MM/yy", { locale: fr })}</>
        )}
      </div>

      {isActive ? (
        <Badge className="bg-emerald-100 text-emerald-700 h-5 text-[10px]">Active</Badge>
      ) : (
        <Badge variant="secondary" className="h-5 text-[10px]">Terminée</Badge>
      )}

      {prestation.quote?.reference && (
        <Badge variant="outline" className="h-5 text-[10px] gap-0.5">
          <FileText className="h-2.5 w-2.5" />
          {prestation.quote.reference}
        </Badge>
      )}

      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-rose-600 hover:text-rose-700"
        onClick={handleDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Note : la création d'une mission a été extraite en page complète
// (CreateMissionPage à /clients/:id/missions/new) pour coller au flow Xelya
// — 1 page = mission + prestations en batch. Cf. lessons.md 2026-05-15.

// =========================================================================
// ADD PRESTATION DIALOG
// =========================================================================

// Jours de la semaine — codes alignés sur le moteur InterventionExpander.
const WEEKDAYS = [
  { code: "mon", label: "L" },
  { code: "tue", label: "M" },
  { code: "wed", label: "M" },
  { code: "thu", label: "J" },
  { code: "fri", label: "V" },
  { code: "sat", label: "S" },
  { code: "sun", label: "D" },
] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AddPrestationDialog({
  missionId,
  clientId,
  onClose,
}: {
  missionId: number;
  clientId: number;
  onClose: () => void;
}) {
  const { data: productsData } = useProducts({ per_page: 200, status: "active" });
  const products = (productsData as any)?.data ?? [];
  const createPresta = useCreatePrestation(missionId, clientId);

  const [form, setForm] = useState({
    product_id: "",
    label: "",
    start_date: todayStr(),
    end_date: "",
    billing_type: "hourly" as Prestation["billing_type"],
    pricing_type: "default" as "default" | "custom",
    custom_price: "",
    base_price: "",
    // Nature + récurrence (refonte 2026-05-21)
    nature: "punctual" as "regular" | "punctual",
    recurrence_frequency: "weekly" as "daily" | "weekly" | "monthly" | "yearly",
    recurrence_interval: 1,
    recurrence_days_of_week: "mon",
    recurrence_start_time: "09:00",
    recurrence_end_time: "11:00",
    recurrence_end_type: "never" as "never" | "on_date" | "after_occurrences",
    recurrence_occurrences_count: "",
  });

  const isRecurring = form.nature === "regular";
  const isCustomPrice = form.pricing_type === "custom";

  // Auto-fill on product change : le prix base = prix catalogue (verrouillé).
  const handleProductChange = (productId: string) => {
    const p = products.find((x: any) => String(x.id) === productId);
    setForm((f) => ({
      ...f,
      product_id: productId,
      label: f.label || p?.name || "",
      base_price: p?.price != null ? String(p.price) : "",
    }));
  };

  const togglePricing = (custom: boolean) => {
    setForm((f) => ({
      ...f,
      pricing_type: custom ? "custom" : "default",
      custom_price: custom ? f.custom_price || f.base_price : "",
    }));
  };

  const toggleDay = (code: string) => {
    const days = form.recurrence_days_of_week.split(",").map((d) => d.trim()).filter(Boolean);
    const next = days.includes(code) ? days.filter((d) => d !== code) : [...days, code];
    const ordered = WEEKDAYS.filter((w) => next.includes(w.code)).map((w) => w.code);
    setForm((f) => ({ ...f, recurrence_days_of_week: ordered.join(",") }));
  };

  const activeDays = form.recurrence_days_of_week.split(",").map((d) => d.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation au clic (jamais de submit disabled pour règle métier).
    const errs: string[] = [];
    if (!form.label.trim()) errs.push("Libellé requis.");
    if (isCustomPrice && (!form.custom_price || Number(form.custom_price) < 0)) {
      errs.push("Prix personnalisé invalide.");
    }
    if (isRecurring) {
      if (form.recurrence_frequency === "weekly" && !form.recurrence_days_of_week.trim()) {
        errs.push("Choisis au moins un jour de la semaine.");
      }
      if (!form.recurrence_start_time || !form.recurrence_end_time) {
        errs.push("Heures de début/fin requises.");
      }
      if (
        form.recurrence_start_time &&
        form.recurrence_end_time &&
        form.recurrence_end_time <= form.recurrence_start_time
      ) {
        errs.push("L'heure de fin doit suivre l'heure de début.");
      }
      if (form.recurrence_end_type === "on_date" && !form.end_date) {
        errs.push("Date de fin requise.");
      }
      if (
        form.recurrence_end_type === "after_occurrences" &&
        (!form.recurrence_occurrences_count || Number(form.recurrence_occurrences_count) < 1)
      ) {
        errs.push("Nombre d'occurrences invalide.");
      }
    }
    if (errs.length > 0) {
      toast.error(errs.join(" "));
      return;
    }

    try {
      await createPresta.mutateAsync({
        product_id: form.product_id ? Number(form.product_id) : null,
        label: form.label.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        billing_type: form.billing_type,
        pricing_type: form.pricing_type,
        custom_price:
          isCustomPrice && form.custom_price ? Number(form.custom_price) : null,
        base_price: form.base_price ? Number(form.base_price) : null,
        nature: form.nature,
        recurrence_frequency: isRecurring ? form.recurrence_frequency : null,
        recurrence_interval: isRecurring ? Number(form.recurrence_interval) || 1 : null,
        recurrence_days_of_week:
          isRecurring && form.recurrence_frequency === "weekly"
            ? form.recurrence_days_of_week
            : null,
        recurrence_start_time: isRecurring ? form.recurrence_start_time : null,
        recurrence_end_time: isRecurring ? form.recurrence_end_time : null,
        recurrence_end_type: isRecurring ? form.recurrence_end_type : null,
        recurrence_occurrences_count:
          isRecurring && form.recurrence_end_type === "after_occurrences"
            ? Number(form.recurrence_occurrences_count)
            : null,
      });
      toast.success(
        isRecurring
          ? "Prestation récurrente ajoutée · RDV à pourvoir généré"
          : "Prestation ajoutée",
      );
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Ajout impossible");
    }
  };

  return (
    <DialogContent className="sm:!max-w-xl max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Ajouter une prestation
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3 py-2">
        <div>
          <Label className="text-xs">Produit catalogue (optionnel)</Label>
          <Select value={form.product_id} onValueChange={handleProductChange}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un produit du catalogue…" /></SelectTrigger>
            <SelectContent>
              {products.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <span className="font-mono text-[10px] mr-2">{p.code}</span>
                  {p.name} <span className="text-muted-foreground ml-1">({Number(p.price).toFixed(2)} €)</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="label" className="text-xs">Libellé *</Label>
          <Input
            id="label"
            placeholder="Ex: Ménage 2h"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Type de facturation</Label>
            <Select
              value={form.billing_type ?? "hourly"}
              onValueChange={(v) => setForm({ ...form, billing_type: v as Prestation["billing_type"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Horaire</SelectItem>
                <SelectItem value="forfait">Forfait</SelectItem>
                <SelectItem value="frais">Frais</SelectItem>
                <SelectItem value="remise">Remise</SelectItem>
                <SelectItem value="carte">Carte</SelectItem>
                <SelectItem value="exceptional">Exceptionnel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Début</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
        </div>

        {/* Étape 6 — Prix verrouillé + case "Prix personnalisé" */}
        <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              {!isCustomPrice && <Lock className="h-3 w-3" />}
              Prix de la prestation
            </Label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={isCustomPrice}
                onChange={(e) => togglePricing(e.target.checked)}
              />
              <span className={isCustomPrice ? "font-medium text-amber-600" : "text-muted-foreground"}>
                Prix personnalisé
              </span>
            </label>
          </div>
          {!isCustomPrice ? (
            <div className="flex items-center gap-2">
              <Input type="number" value={form.base_price} readOnly disabled
                className="bg-muted cursor-not-allowed" placeholder="Prix catalogue" />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Tarif catalogue</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input type="number" step="0.01" min="0" value={form.custom_price}
                onChange={(e) => setForm({ ...form, custom_price: e.target.value })}
                placeholder="Prix négocié (€)" autoFocus />
              <span className="text-[10px] text-amber-600 whitespace-nowrap">
                Catalogue : {form.base_price ? `${Number(form.base_price).toFixed(2)} €` : "—"}
              </span>
            </div>
          )}
        </div>

        {/* Étape 2 — Nature : Ponctuelle / Récurrente */}
        <div className="rounded-md border p-2.5 space-y-2.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Nature de la prestation
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { val: "punctual", label: "Ponctuelle", desc: "RDV créés manuellement" },
              { val: "regular", label: "Récurrente", desc: "RDV générés automatiquement" },
            ] as const).map((opt) => {
              const active = form.nature === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, nature: opt.val }))}
                  className={
                    "text-left rounded-md border px-2.5 py-1.5 transition-colors " +
                    (active ? "border-primary bg-primary/10" : "border-input hover:bg-muted")
                  }
                >
                  <div className={"text-xs font-medium " + (active ? "text-primary" : "")}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                </button>
              );
            })}
          </div>

          {isRecurring && (
            <div className="space-y-2.5 pt-1 border-t mt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Fréquence</Label>
                  <Select
                    value={form.recurrence_frequency}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, recurrence_frequency: v as typeof f.recurrence_frequency }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Quotidienne</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                      <SelectItem value="yearly">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Intervalle</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.recurrence_interval}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, recurrence_interval: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
              </div>

              {form.recurrence_frequency === "weekly" && (
                <div>
                  <Label className="text-[10px]">Jours de la semaine</Label>
                  <div className="flex gap-1 mt-0.5">
                    {WEEKDAYS.map((d) => {
                      const on = activeDays.includes(d.code);
                      return (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() => toggleDay(d.code)}
                          className={
                            "h-7 w-7 rounded-md border text-xs font-medium transition-colors " +
                            (on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input hover:bg-muted")
                          }
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Heure début
                  </Label>
                  <Input
                    type="time"
                    value={form.recurrence_start_time}
                    onChange={(e) => setForm({ ...form, recurrence_start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Heure fin
                  </Label>
                  <Input
                    type="time"
                    value={form.recurrence_end_time}
                    onChange={(e) => setForm({ ...form, recurrence_end_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Fin de la récurrence</Label>
                <Select
                  value={form.recurrence_end_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, recurrence_end_type: v as typeof f.recurrence_end_type }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Jamais</SelectItem>
                    <SelectItem value="on_date">À une date</SelectItem>
                    <SelectItem value="after_occurrences">Après N occurrences</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.recurrence_end_type === "on_date" && (
                <div>
                  <Label className="text-[10px]">Date de fin</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    min={form.start_date || undefined}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              )}

              {form.recurrence_end_type === "after_occurrences" && (
                <div>
                  <Label className="text-[10px]">Nombre d'occurrences</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.recurrence_occurrences_count}
                    onChange={(e) =>
                      setForm({ ...form, recurrence_occurrences_count: e.target.value })
                    }
                    placeholder="Ex: 12"
                  />
                </div>
              )}
            </div>
          )}

          {!isRecurring && (
            <div>
              <Label className="text-[10px]">Fin de prestation (optionnel)</Label>
              <Input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={createPresta.isPending}>
            {createPresta.isPending ? "Ajout…" : "Ajouter la prestation"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
