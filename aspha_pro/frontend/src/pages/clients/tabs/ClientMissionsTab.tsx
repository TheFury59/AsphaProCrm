import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Briefcase, Plus, ChevronDown, ChevronRight, Trash2,
  Package, FileText, MoreHorizontal,
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
  useClientMissions, useCreateMission, useDeleteMission,
  useCreatePrestation, useDeletePrestation,
  type Mission, type Prestation, type MissionStatus,
} from "@/hooks/use-missions";
import { useProducts } from "@/hooks/use-products";

/**
 * Onglet "Missions & prestations" — hiérarchie métier :
 *   Client → 1..N Missions → 1..N Prestations contractualisées → Devis
 *
 * Une Mission = un contrat de service (ex: "Ménage hebdo M. Dupont")
 * Une Prestation = une ligne facturable (ex: "Repassage 2h", "Vitres forfait")
 */
export function ClientMissionsTab({ clientId }: { clientId: number }) {
  const { data: missions = [], isLoading } = useClientMissions(clientId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Missions du client ({missions.length})
        </CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Nouvelle mission
            </Button>
          </DialogTrigger>
          <CreateMissionDialog clientId={clientId} onClose={() => setCreateOpen(false)} />
        </Dialog>
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
    if (!confirm(`Supprimer la mission "${mission.name}" ?`)) return;
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
    if (!confirm(`Supprimer la prestation "${prestation.label}" ?`)) return;
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

// =========================================================================
// CREATE MISSION DIALOG
// =========================================================================

function CreateMissionDialog({
  clientId,
  onClose,
}: {
  clientId: number;
  onClose: () => void;
}) {
  const createMission = useCreateMission(clientId);
  const [form, setForm] = useState({
    name: "",
    status: "active" as MissionStatus,
    billing_rhythm: "",
    payment_methods: "",
    no_intervention_no_bill: false,
    online_payment_enabled: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createMission.mutateAsync({
        name: form.name.trim(),
        status: form.status,
        billing_rhythm: form.billing_rhythm || null,
        payment_methods: form.payment_methods || null,
        no_intervention_no_bill: form.no_intervention_no_bill,
        online_payment_enabled: form.online_payment_enabled,
      });
      toast.success("Mission créée");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Création impossible");
    }
  };

  return (
    <DialogContent className="sm:!max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Nouvelle mission
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3 py-2">
        <div>
          <Label htmlFor="name" className="text-xs">Nom de la mission *</Label>
          <Input
            id="name"
            placeholder="Ex: Ménage hebdomadaire — M. Dupont"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Statut</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as MissionStatus })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspendue</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Rythme de facturation</Label>
            <Input
              placeholder="Ex: mensuel"
              value={form.billing_rhythm}
              onChange={(e) => setForm({ ...form, billing_rhythm: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Modes de paiement acceptés</Label>
          <Input
            placeholder="Ex: CB, SEPA, CESU"
            value={form.payment_methods}
            onChange={(e) => setForm({ ...form, payment_methods: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.no_intervention_no_bill}
              onChange={(e) => setForm({ ...form, no_intervention_no_bill: e.target.checked })}
            />
            Pas d'intervention = pas de facturation
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.online_payment_enabled}
              onChange={(e) => setForm({ ...form, online_payment_enabled: e.target.checked })}
            />
            Paiement en ligne
          </label>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={createMission.isPending || !form.name.trim()}>
            {createMission.isPending ? "Création…" : "Créer la mission"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// =========================================================================
// ADD PRESTATION DIALOG
// =========================================================================

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
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    billing_type: "hourly" as Prestation["billing_type"],
    pricing_type: "default" as "default" | "custom",
    custom_price: "",
    base_price: "",
  });

  // Auto-fill on product change
  const handleProductChange = (productId: string) => {
    const p = products.find((x: any) => String(x.id) === productId);
    setForm((f) => ({
      ...f,
      product_id: productId,
      label: f.label || p?.name || "",
      base_price: p?.price ? String(p.price) : f.base_price,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    try {
      await createPresta.mutateAsync({
        product_id: form.product_id ? Number(form.product_id) : null,
        label: form.label.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        billing_type: form.billing_type,
        pricing_type: form.pricing_type,
        custom_price: form.pricing_type === "custom" && form.custom_price
          ? Number(form.custom_price) : null,
        base_price: form.base_price ? Number(form.base_price) : null,
      });
      toast.success("Prestation ajoutée");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Ajout impossible");
    }
  };

  return (
    <DialogContent className="sm:!max-w-xl">
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
            required
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
            <Label className="text-xs">Tarification</Label>
            <Select
              value={form.pricing_type}
              onValueChange={(v) => setForm({ ...form, pricing_type: v as "default" | "custom" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Tarif catalogue</SelectItem>
                <SelectItem value="custom">Tarif personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Prix de base (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.base_price}
              onChange={(e) => setForm({ ...form, base_price: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">
              Prix custom (€) {form.pricing_type === "custom" && <span className="text-amber-600">*</span>}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.custom_price}
              onChange={(e) => setForm({ ...form, custom_price: e.target.value })}
              disabled={form.pricing_type !== "custom"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Début</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Fin (optionnel)</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={createPresta.isPending || !form.label.trim()}>
            {createPresta.isPending ? "Ajout…" : "Ajouter la prestation"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
