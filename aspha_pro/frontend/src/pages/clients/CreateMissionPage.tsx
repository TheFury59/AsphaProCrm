import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Briefcase, Package, Plus, Trash2, FileText, CreditCard,
  Calendar as CalIcon, Receipt, Loader2,
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
import { useClient } from "@/hooks/use-clients";
import { useProducts } from "@/hooks/use-products";
import {
  useCreateMission, useClientQuotes,
  type MissionStatus, type PrestationDraft,
} from "@/hooks/use-missions";

/**
 * Page de création d'une mission — flow Xelya/Ximi :
 *   1. Informations principales (nom, statut, devis associé)
 *   2. Facturation (rythme, moyens de paiement, options)
 *   3. Prestations contractualisées (1..N, ajout direct depuis le catalogue produits)
 *
 * Création en batch : POST /clients/{c}/missions avec `prestations[]` →
 * 1 transaction SQL crée la mission + toutes ses prestations.
 *
 * Route : /clients/:id/missions/new
 */

// =========================================================================
// Constantes métier (cf. DBML)
// =========================================================================

const PAYMENT_METHODS = [
  { value: "check", label: "Chèque" },
  { value: "sepa", label: "Prélèvement SEPA" },
  { value: "card", label: "Carte bancaire" },
  { value: "transfer", label: "Virement" },
  { value: "cash", label: "Espèces" },
] as const;

const BILLING_RHYTHMS = [
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Quinzaine" },
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "per_intervention", label: "À la prestation" },
] as const;

const BILLING_TYPES = [
  { value: "hourly", label: "Horaire" },
  { value: "forfait", label: "Forfait" },
  { value: "frais", label: "Frais" },
  { value: "remise", label: "Remise" },
  { value: "carte", label: "Carte" },
  { value: "exceptional", label: "Exceptionnel" },
] as const;

// =========================================================================
// Page
// =========================================================================

export function CreateMissionPage() {
  const { id } = useParams();
  const clientId = id ? parseInt(id, 10) : null;
  const navigate = useNavigate();

  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { data: quotes = [] } = useClientQuotes(clientId ?? 0);
  const { data: productsData } = useProducts({ per_page: 200, status: "active" });
  const products = (productsData as any)?.data ?? [];

  const createMission = useCreateMission(clientId ?? 0);

  // -- Form state ----------------------------------------------------------
  const [name, setName] = useState("");
  const [status, setStatus] = useState<MissionStatus>("active");
  const [quoteId, setQuoteId] = useState<string>("");
  const [billingRhythm, setBillingRhythm] = useState<string>("monthly");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["check", "sepa", "transfer"]);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
  const [noInterventionNoBill, setNoInterventionNoBill] = useState(true);
  const [prestations, setPrestations] = useState<PrestationDraft[]>([emptyPrestation()]);

  // -- Helpers prestation --------------------------------------------------
  function emptyPrestation(): PrestationDraft {
    return {
      product_id: null,
      label: "",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: null,
      billing_type: "hourly",
      pricing_type: "default",
      custom_price: null,
      base_price: null,
      no_intervention_no_bill: false,
    };
  }

  const updatePrestation = (idx: number, patch: Partial<PrestationDraft>) => {
    setPrestations((arr) => arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removePrestation = (idx: number) => {
    setPrestations((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)));
  };

  const onProductPick = (idx: number, productId: string) => {
    const p = products.find((x: any) => String(x.id) === productId);
    updatePrestation(idx, {
      product_id: productId ? Number(productId) : null,
      label: prestations[idx].label || p?.name || "",
      billing_type: (p?.type as PrestationDraft["billing_type"]) ?? prestations[idx].billing_type,
      base_price: p?.price ? Number(p.price) : prestations[idx].base_price,
    });
  };

  const togglePaymentMethod = (value: string) => {
    setPaymentMethods((arr) =>
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    );
  };

  // -- Submit --------------------------------------------------------------
  const canSubmit =
    !!name.trim() &&
    prestations.length > 0 &&
    prestations.every((p) => p.label.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !canSubmit) return;

    try {
      const mission = await createMission.mutateAsync({
        name: name.trim(),
        status,
        quote_id: quoteId ? Number(quoteId) : null,
        billing_rhythm: billingRhythm || null,
        payment_methods: paymentMethods.length ? paymentMethods.join(",") : null,
        online_payment_enabled: onlinePaymentEnabled,
        no_intervention_no_bill: noInterventionNoBill,
        prestations: prestations.map((p) => ({
          product_id: p.product_id || null,
          label: p.label.trim(),
          start_date: p.start_date || null,
          end_date: p.end_date || null,
          billing_type: p.billing_type ?? null,
          pricing_type: p.pricing_type ?? "default",
          base_price: p.base_price != null ? Number(p.base_price) : null,
          custom_price:
            p.pricing_type === "custom" && p.custom_price != null ? Number(p.custom_price) : null,
          no_intervention_no_bill: !!p.no_intervention_no_bill,
        })),
      });
      toast.success(`Mission "${mission.name}" créée avec ${prestations.length} prestation(s)`);
      navigate(`/clients/${clientId}#missions`);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Création impossible";
      const errors = err.response?.data?.errors;
      toast.error(msg, {
        description: errors ? Object.values(errors).flat().slice(0, 2).join(" · ") : undefined,
      });
    }
  };

  // -- Render --------------------------------------------------------------
  if (clientLoading || !client || !clientId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const clientLabel = client.company?.company_name ?? client.display_name ?? `Client #${clientId}`;

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title="Nouvelle mission"
        description={`Pour ${clientLabel} · code ${client.code}`}
        backTo={`/clients/${clientId}`}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => navigate(`/clients/${clientId}`)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit || createMission.isPending} className="gap-2">
              {createMission.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createMission.isPending ? "Création…" : "Créer la mission"}
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
                Une mission représente un contrat de service récurrent ou ponctuel pour ce client.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nom de la mission *</Label>
                <Input
                  placeholder="Ex: Ménage hebdomadaire — domicile principal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
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

                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Devis associé (optionnel)
                  </Label>
                  <Select value={quoteId || "none"} onValueChange={(v) => setQuoteId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={quotes.length ? "Sélectionner…" : "Aucun devis pour ce client"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Aucun —</SelectItem>
                      {quotes.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          <span className="font-mono text-[11px] mr-2">{q.reference ?? `#${q.id}`}</span>
                          {Number(q.total).toFixed(2)} € ·{" "}
                          <Badge variant="outline" className="ml-1 text-[9px] h-4">{q.status}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3 — Prestations contractualisées */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Prestations contractualisées ({prestations.length})
                </CardTitle>
                <CardDescription>
                  Chaque prestation devient une ligne de devis/facture. Au moins une est requise.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setPrestations((arr) => [...arr, emptyPrestation()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {prestations.map((p, idx) => (
                <PrestationCard
                  key={idx}
                  idx={idx}
                  prestation={p}
                  products={products}
                  canRemove={prestations.length > 1}
                  onChange={(patch) => updatePrestation(idx, patch)}
                  onProductPick={(pid) => onProductPick(idx, pid)}
                  onRemove={() => removePrestation(idx)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* COLONNE DROITE (1/3) : Facturation + Récap                     */}
        {/* ============================================================== */}
        <div className="space-y-4">
          {/* SECTION 2 — Facturation */}
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
              <RecapRow label="Mission" value={name || <em className="text-muted-foreground">non renseigné</em>} />
              <RecapRow label="Statut" value={<Badge variant="outline">{status}</Badge>} />
              <RecapRow
                label="Prestations"
                value={
                  <span className="font-mono">
                    {prestations.filter((p) => p.label.trim()).length} / {prestations.length}
                  </span>
                }
              />
              <RecapRow
                label="Total HT estimé"
                value={
                  <span className="font-semibold tabular-nums">
                    {prestations
                      .reduce((sum, p) => {
                        const price = p.pricing_type === "custom" ? p.custom_price : p.base_price;
                        return sum + Number(price ?? 0);
                      }, 0)
                      .toFixed(2)}{" "}
                    €
                  </span>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

// =========================================================================
// Sous-composant : carte d'édition d'une prestation
// =========================================================================

function PrestationCard({
  idx,
  prestation: p,
  products,
  canRemove,
  onChange,
  onProductPick,
  onRemove,
}: {
  idx: number;
  prestation: PrestationDraft;
  products: any[];
  canRemove: boolean;
  onChange: (patch: Partial<PrestationDraft>) => void;
  onProductPick: (productId: string) => void;
  onRemove: () => void;
}) {
  const effectivePrice =
    p.pricing_type === "custom" ? p.custom_price : p.base_price;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-mono">#{idx + 1}</Badge>
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium flex-1 truncate">
          {p.label || <em className="text-muted-foreground">Nouvelle prestation</em>}
        </span>
        {effectivePrice != null && (
          <span className="text-xs font-semibold tabular-nums">
            {Number(effectivePrice).toFixed(2)} €
          </span>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-rose-600 hover:text-rose-700"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? "Supprimer cette prestation" : "Au moins une prestation est requise"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[10px]">Produit du catalogue</Label>
          <Select
            value={p.product_id ? String(p.product_id) : "none"}
            onValueChange={(v) => onProductPick(v === "none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Sélectionner un produit…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Libre (sans produit) —</SelectItem>
              {products.map((prod: any) => (
                <SelectItem key={prod.id} value={String(prod.id)}>
                  <span className="font-mono text-[10px] mr-2">{prod.code}</span>
                  {prod.name}
                  <span className="text-muted-foreground ml-1">
                    ({Number(prod.price).toFixed(2)} €)
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label className="text-[10px]">Libellé *</Label>
          <Input
            value={p.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Ex: Ménage 2h"
            required
          />
        </div>

        <div>
          <Label className="text-[10px]">Type facturation</Label>
          <Select
            value={p.billing_type ?? "hourly"}
            onValueChange={(v) => onChange({ billing_type: v as PrestationDraft["billing_type"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BILLING_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px]">Tarification</Label>
          <Select
            value={p.pricing_type ?? "default"}
            onValueChange={(v) => onChange({ pricing_type: v as "default" | "custom" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Tarif catalogue</SelectItem>
              <SelectItem value="custom">Tarif personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px]">Prix base (€)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={p.base_price ?? ""}
            onChange={(e) =>
              onChange({ base_price: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="0.00"
          />
        </div>

        <div>
          <Label className="text-[10px]">
            Prix custom (€){" "}
            {p.pricing_type === "custom" && <span className="text-amber-600">*</span>}
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={p.custom_price ?? ""}
            onChange={(e) =>
              onChange({ custom_price: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="0.00"
            disabled={p.pricing_type !== "custom"}
          />
        </div>

        <div>
          <Label className="text-[10px] flex items-center gap-1">
            <CalIcon className="h-3 w-3" />
            Début
          </Label>
          <Input
            type="date"
            value={p.start_date ?? ""}
            onChange={(e) => onChange({ start_date: e.target.value || null })}
          />
        </div>

        <div>
          <Label className="text-[10px]">Fin (optionnel)</Label>
          <Input
            type="date"
            value={p.end_date ?? ""}
            onChange={(e) => onChange({ end_date: e.target.value || null })}
          />
        </div>
      </div>
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
