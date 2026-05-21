import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Briefcase, Package, Plus, FileText, CreditCard, Receipt, Loader2, Save, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useClient } from "@/hooks/use-clients";
import { useProducts } from "@/hooks/use-products";
import {
  useMission, useMissionPrestations, useUpdateMission,
  useCreatePrestation, useUpdatePrestation, useDeletePrestation,
  type MissionStatus, type PrestationDraft, type Prestation,
} from "@/hooks/use-missions";
import {
  PrestationFormCard, emptyPrestation, validatePrestation, serializePrestation,
  PAYMENT_METHODS, BILLING_RHYTHMS,
} from "@/components/missions/PrestationFormCard";

/**
 * Page d'édition d'une mission existante.
 *
 * Route : /clients/:id/missions/:missionId
 *
 * Différence avec CreateMissionPage : la création était un batch (1 POST →
 * mission + prestations en une transaction). L'édition persiste pièce par
 * pièce :
 *   - les infos mission via `useUpdateMission` (bouton « Enregistrer la mission ») ;
 *   - chaque prestation existante via `useUpdatePrestation` / `useDeletePrestation` ;
 *   - une prestation nouvellement ajoutée via `useCreatePrestation`.
 *
 * Le formulaire de prestation (nature, récurrence, prix verrouillé) est le
 * composant partagé `PrestationFormCard`, IDENTIQUE à celui de la création.
 */

/** Convertit une prestation API en draft éditable (pré-remplissage du formulaire). */
function toDraft(p: Prestation): PrestationDraft {
  return {
    product_id: p.product_id,
    label: p.label ?? "",
    start_date: p.start_date,
    end_date: p.end_date,
    billing_type: (p.billing_type as PrestationDraft["billing_type"]) ?? "hourly",
    pricing_type: p.pricing_type ?? "default",
    custom_price: p.custom_price != null ? Number(p.custom_price) : null,
    base_price: p.base_price != null ? Number(p.base_price) : null,
    no_intervention_no_bill: !!p.no_intervention_no_bill,
    nature: p.nature ?? "punctual",
    recurrence_frequency: p.recurrence_frequency ?? "weekly",
    recurrence_interval: p.recurrence_interval ?? 1,
    recurrence_days_of_week: p.recurrence_days_of_week ?? "mon",
    recurrence_start_time: p.recurrence_start_time ?? "09:00",
    recurrence_end_time: p.recurrence_end_time ?? "11:00",
    recurrence_end_type: p.recurrence_end_type ?? "never",
    recurrence_occurrences_count: p.recurrence_occurrences_count ?? null,
  };
}

/** Ligne de prestation en cours d'édition : un draft + l'id BDD (null = nouvelle). */
type PrestationRow = { id: number | null; draft: PrestationDraft };

export function EditMissionPage() {
  const { id, missionId: missionIdParam } = useParams();
  const clientId = id ? parseInt(id, 10) : null;
  const missionId = missionIdParam ? parseInt(missionIdParam, 10) : null;
  const navigate = useNavigate();

  const { data: client } = useClient(clientId);
  const { data: mission, isLoading: missionLoading } = useMission(missionId);
  const { data: prestations, isLoading: prestaLoading } = useMissionPrestations(missionId);
  const { data: productsData } = useProducts({ per_page: 200, status: "active" });
  const products = (productsData as any)?.data ?? [];

  const updateMission = useUpdateMission(missionId ?? 0, clientId ?? undefined);
  const createPresta = useCreatePrestation(missionId ?? 0, clientId ?? undefined);
  const updatePresta = useUpdatePrestation(missionId ?? 0, clientId ?? undefined);
  const deletePresta = useDeletePrestation(missionId ?? 0, clientId ?? undefined);

  // -- Form state : infos mission ------------------------------------------
  const [name, setName] = useState("");
  const [status, setStatus] = useState<MissionStatus>("active");
  const [billingRhythm, setBillingRhythm] = useState<string>("monthly");
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
  const [noInterventionNoBill, setNoInterventionNoBill] = useState(true);

  // -- Form state : prestations --------------------------------------------
  const [rows, setRows] = useState<PrestationRow[]>([]);
  // Index de la ligne en cours de mutation (save ou delete) pour le spinner.
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  // Ligne dont la suppression est en attente de confirmation.
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  // Garde-fou : on n'hydrate le formulaire qu'au PREMIER chargement. Les
  // mutations (save/create/delete) invalident le cache et déclenchent un
  // refetch ; sans ce flag, le useEffect réécraserait les modifications en
  // cours sur les autres cartes (cf. lessons.md : sync state<-prop gardée).
  const [hydrated, setHydrated] = useState(false);

  // Hydratation du formulaire en UN SEUL passage, dès que mission ET
  // prestations sont disponibles. Le flag `hydrated` empêche tout refetch
  // ultérieur (déclenché par une mutation) de réécraser les modifications
  // en cours sur les autres cartes.
  useEffect(() => {
    if (hydrated || !mission || !prestations) return;
    setName(mission.name ?? "");
    setStatus(mission.status ?? "active");
    setBillingRhythm(mission.billing_rhythm ?? "monthly");
    setPaymentMethods(
      mission.payment_methods ? mission.payment_methods.split(",").map((m) => m.trim()).filter(Boolean) : [],
    );
    setOnlinePaymentEnabled(!!mission.online_payment_enabled);
    setNoInterventionNoBill(!!mission.no_intervention_no_bill);
    setRows(prestations.map((p) => ({ id: p.id, draft: toDraft(p) })));
    setHydrated(true);
  }, [mission, prestations, hydrated]);

  // -- Helpers prestations -------------------------------------------------
  const patchRow = (idx: number, patch: Partial<PrestationDraft>) => {
    setRows((arr) => arr.map((r, i) => (i === idx ? { ...r, draft: { ...r.draft, ...patch } } : r)));
  };

  const onProductPick = (idx: number, productId: string) => {
    const p = products.find((x: any) => String(x.id) === productId);
    patchRow(idx, {
      product_id: productId ? Number(productId) : null,
      label: rows[idx].draft.label || p?.name || "",
      billing_type: (p?.type as PrestationDraft["billing_type"]) ?? rows[idx].draft.billing_type,
      base_price: p?.price != null ? Number(p.price) : null,
    });
  };

  const togglePaymentMethod = (value: string) => {
    setPaymentMethods((arr) =>
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    );
  };

  // -- Persistance : infos mission -----------------------------------------
  const handleSaveMission = async () => {
    if (!name.trim()) {
      toast.error("Le nom de la mission est requis.");
      return;
    }
    try {
      await updateMission.mutateAsync({
        name: name.trim(),
        status,
        billing_rhythm: billingRhythm || null,
        payment_methods: paymentMethods.length ? paymentMethods.join(",") : null,
        online_payment_enabled: onlinePaymentEnabled,
        no_intervention_no_bill: noInterventionNoBill,
      });
      toast.success("Mission mise à jour");
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Mise à jour impossible";
      const errors = err.response?.data?.errors;
      console.error("updateMission failed", err.response?.data ?? err);
      toast.error(msg, {
        description: errors ? Object.values(errors).flat().slice(0, 2).join(" · ") : undefined,
      });
    }
  };

  // -- Persistance : une prestation (create OU update) ---------------------
  const handleSavePrestation = async (idx: number) => {
    const row = rows[idx];
    const errs = validatePrestation(row.draft, "Prestation");
    if (errs.length > 0) {
      toast.error(`Impossible d'enregistrer — ${errs.length} point(s) à corriger`, {
        description: errs.slice(0, 4).map((x) => `• ${x}`).join("\n"),
        duration: 6000,
      });
      return;
    }

    const payload = serializePrestation(row.draft);
    setBusyIdx(idx);
    try {
      if (row.id == null) {
        const created = await createPresta.mutateAsync(payload as Partial<Prestation>);
        // Mémorise l'id retourné pour que la ligne bascule en « update ».
        setRows((arr) => arr.map((r, i) => (i === idx ? { ...r, id: created.id } : r)));
        toast.success(
          row.draft.nature === "regular"
            ? "Prestation récurrente ajoutée · RDV à pourvoir généré"
            : "Prestation ajoutée",
        );
      } else {
        await updatePresta.mutateAsync({ id: row.id, ...(payload as Partial<Prestation>) });
        toast.success(
          row.draft.nature === "regular"
            ? "Prestation mise à jour · interventions resynchronisées"
            : "Prestation mise à jour",
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Enregistrement impossible";
      const errors = err.response?.data?.errors;
      console.error("savePrestation failed", { payload, response: err.response?.data ?? err });
      toast.error(msg, {
        description: errors ? Object.values(errors).flat().slice(0, 2).join(" · ") : undefined,
      });
    } finally {
      setBusyIdx(null);
    }
  };

  // -- Suppression d'une prestation ----------------------------------------
  const handleRemoveRow = (idx: number) => {
    const row = rows[idx];
    // Ligne jamais persistée : retrait local immédiat, pas d'appel API.
    if (row.id == null) {
      setRows((arr) => arr.filter((_, i) => i !== idx));
      return;
    }
    // Ligne persistée : confirmation avant DELETE.
    setDeleteTarget(idx);
  };

  const confirmDelete = async () => {
    if (deleteTarget == null) return;
    const idx = deleteTarget;
    const row = rows[idx];
    setDeleteTarget(null);
    if (row.id == null) return;
    setBusyIdx(idx);
    try {
      await deletePresta.mutateAsync(row.id);
      setRows((arr) => arr.filter((_, i) => i !== idx));
      toast.success("Prestation supprimée");
    } catch (err: any) {
      console.error("deletePrestation failed", err.response?.data ?? err);
      toast.error(err.response?.data?.message ?? "Suppression impossible");
    } finally {
      setBusyIdx(null);
    }
  };

  // -- Render --------------------------------------------------------------
  if (missionLoading || prestaLoading || !mission || !missionId || !clientId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const clientLabel =
    client?.company?.company_name ?? client?.display_name ?? `Client #${clientId}`;

  const totalHt = rows.reduce((sum, r) => {
    const price = r.draft.pricing_type === "custom" ? r.draft.custom_price : r.draft.base_price;
    return sum + Number(price ?? 0);
  }, 0);

  return (
    <div>
      <PageHeader
        title="Modifier la mission"
        description={`${mission.name} · pour ${clientLabel}`}
        backTo={`/clients/${clientId}#missions`}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/clients/${clientId}#missions`)}
            >
              Retour
            </Button>
            <Button
              type="button"
              onClick={handleSaveMission}
              disabled={updateMission.isPending}
              className="gap-2"
            >
              {updateMission.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {updateMission.isPending ? "Enregistrement…" : "Enregistrer la mission"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ============================================================== */}
        {/* COLONNE GAUCHE (2/3) : Identification + Prestations            */}
        {/* ============================================================== */}
        <div className="lg:col-span-2 space-y-4">
          {/* SECTION 1 — Identification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Informations principales
              </CardTitle>
              <CardDescription>
                Les modifications des infos mission sont enregistrées via le bouton en haut à droite.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nom de la mission *</Label>
                <Input
                  placeholder="Ex: Ménage hebdomadaire — domicile principal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Statut</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as MissionStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspendue</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mission.quote?.reference && (
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Devis associé
                    </Label>
                    <div className="h-9 flex items-center">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {mission.quote.reference}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2 — Prestations contractualisées */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Prestations contractualisées ({rows.length})
                </CardTitle>
                <CardDescription>
                  Chaque prestation s'enregistre individuellement via son bouton « Enregistrer ».
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setRows((arr) => [...arr, { id: null, draft: emptyPrestation() }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Aucune prestation. Clique sur « Ajouter » pour en créer une.
                </div>
              )}
              {rows.map((row, idx) => (
                <PrestationFormCard
                  key={row.id ?? `new-${idx}`}
                  idx={idx}
                  prestation={row.draft}
                  products={products}
                  canRemove
                  onChange={(patch) => patchRow(idx, patch)}
                  onProductPick={(pid) => onProductPick(idx, pid)}
                  onRemove={() => handleRemoveRow(idx)}
                  removeTitle={row.id == null ? "Retirer cette prestation" : "Supprimer cette prestation"}
                  removing={busyIdx === idx}
                  headerExtra={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-[11px]"
                      onClick={() => handleSavePrestation(idx)}
                      disabled={busyIdx === idx}
                    >
                      {busyIdx === idx ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {row.id == null ? "Créer" : "Enregistrer"}
                    </Button>
                  }
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* COLONNE DROITE (1/3) : Facturation + Récap                     */}
        {/* ============================================================== */}
        <div className="space-y-4">
          {/* SECTION 3 — Facturation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Facturation
              </CardTitle>
              <CardDescription>Paramètres financiers de la mission.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Rythme de facturation</Label>
                <Select value={billingRhythm} onValueChange={setBillingRhythm}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_RHYTHMS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Moyens de paiement acceptés</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PAYMENT_METHODS.map((m) => {
                    const active = paymentMethods.includes(m.value);
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => togglePaymentMethod(m.value)}
                        className={
                          "text-xs px-2 py-1.5 rounded border transition-colors text-left " +
                          (active
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-input hover:bg-muted")
                        }
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 text-xs">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlinePaymentEnabled}
                    onChange={(e) => setOnlinePaymentEnabled(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Paiement en ligne activé</span>
                    <span className="block text-muted-foreground text-[11px]">
                      Permet au client de payer ses factures en CB depuis l'extranet.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noInterventionNoBill}
                    onChange={(e) => setNoInterventionNoBill(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Pas d'intervention = pas de facturation</span>
                    <span className="block text-muted-foreground text-[11px]">
                      Les annulations/absences sans intervention réalisée ne sont pas facturées.
                    </span>
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* RECAP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Récapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <RecapRow label="Client" value={clientLabel} />
              <RecapRow
                label="Mission"
                value={name || <em className="text-muted-foreground">non renseigné</em>}
              />
              <RecapRow label="Statut" value={<Badge variant="outline">{status}</Badge>} />
              <RecapRow
                label="Prestations"
                value={<span className="font-mono">{rows.length}</span>}
              />
              <RecapRow
                label="Total HT estimé"
                value={
                  <span className="font-semibold tabular-nums">{totalHt.toFixed(2)} €</span>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation de suppression d'une prestation persistée */}
      <Dialog
        open={deleteTarget != null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <DialogContent className="sm:!max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-600" />
              Supprimer la prestation
            </DialogTitle>
            <DialogDescription>
              {deleteTarget != null && rows[deleteTarget] ? (
                <>
                  La prestation «&nbsp;{rows[deleteTarget].draft.label || "sans libellé"}&nbsp;» sera
                  supprimée. Si elle est récurrente, les RDV récurrents générés au planning seront
                  également retirés. Cette action est irréversible.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =========================================================================
// Petits helpers
// =========================================================================

function RecapRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}
