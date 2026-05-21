import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Briefcase, Package, Plus, FileText, CreditCard,
  Receipt, Loader2,
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
import {
  PrestationFormCard, emptyPrestation, validatePrestation, serializePrestation,
  PAYMENT_METHODS, BILLING_RHYTHMS,
} from "@/components/missions/PrestationFormCard";

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
      // Le prix base = prix catalogue du produit (verrouillé tant que pas
      // "prix personnalisé"). Toujours resynchronisé sur le produit choisi.
      base_price: p?.price != null ? Number(p.price) : null,
    });
  };

  const togglePaymentMethod = (value: string) => {
    setPaymentMethods((arr) =>
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    );
  };

  // -- Submit --------------------------------------------------------------
  /**
   * Validation métier au clic (convention projet : jamais de submit `disabled`
   * pour une règle métier — on liste explicitement les erreurs dans un toast).
   */
  const validate = (): string[] => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Le nom de la mission est requis.");
    if (prestations.length === 0) errs.push("Au moins une prestation est requise.");
    prestations.forEach((p, i) => {
      errs.push(...validatePrestation(p, `Prestation ${i + 1}`));
    });
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;

    const errs = validate();
    if (errs.length > 0) {
      toast.error(`Impossible de créer la mission — ${errs.length} point(s) à corriger`, {
        description: errs.slice(0, 4).map((x) => `• ${x}`).join("\n"),
        duration: 6000,
      });
      return;
    }

    try {
      const mission = await createMission.mutateAsync({
        name: name.trim(),
        status,
        quote_id: quoteId ? Number(quoteId) : null,
        billing_rhythm: billingRhythm || null,
        payment_methods: paymentMethods.length ? paymentMethods.join(",") : null,
        online_payment_enabled: onlinePaymentEnabled,
        no_intervention_no_bill: noInterventionNoBill,
        prestations: prestations.map(serializePrestation),
      });
      const recurringCount = prestations.filter((p) => p.nature === "regular").length;
      toast.success(
        `Mission "${mission.name}" créée avec ${prestations.length} prestation(s)` +
          (recurringCount > 0
            ? ` · ${recurringCount} RDV récurrent(s) à pourvoir généré(s)`
            : ""),
      );
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
            <Button type="submit" disabled={createMission.isPending} className="gap-2">
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
                <PrestationFormCard
                  key={idx}
                  idx={idx}
                  prestation={p}
                  products={products}
                  clientId={clientId}
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
