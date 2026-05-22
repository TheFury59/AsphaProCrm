import { useState } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useVatRates, useEntities,
} from "@/hooks/use-products";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Product } from "@/types/api";

const TYPE_LABELS: Record<string, string> = {
  hourly: "Horaire",
  forfait: "Forfait",
  frais: "Frais",
  remise: "Remise",
  carte: "Carte",
  exceptional: "Exceptionnel",
};

// Note : la « nature » (régulier/ponctuel) et le « mode de facturation »
// (per_intervention / per_month / per_week / per_unit) ne sont plus des
// propriétés du catalogue depuis 2026-05-21. Ils se choisissent au moment du
// devis / de la mission. La colonne `products.billing_mode` reste en BDD pour
// la rétro-compat (devis/missions existants) ; le backend lui applique un
// défaut neutre côté store.

export function ProductsListPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useProducts({ per_page: 100, search });

  // Dialog : null = fermé, "new" = création, Product = édition
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  return (
    <div>
      <PageHeader
        title="Catalogue prestations"
        description="Produits & services proposés par Aspha — utilisés dans les devis, factures et plannings."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle prestation
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : data?.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Aucune prestation dans le catalogue.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique sur « Nouvelle prestation » pour créer la première.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((p) => (
            <Card
              key={p.id}
              onClick={() => setEditing(p)}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{p.name}</CardTitle>
                  <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-xs shrink-0">
                    {p.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription className="text-xs font-mono">{p.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-semibold">
                    {p.price.toFixed(2)} € <span className="text-xs font-normal text-muted-foreground">{p.amount_incl_tax ? "TTC" : "HT"}</span>
                  </span>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[p.type] ?? p.type}</Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {p.default_duration_minutes != null && <div>Durée standard : <span className="text-foreground">{p.default_duration_minutes} min</span></div>}
                  {p.vat_rate && <div>TVA : <span className="text-foreground">{p.vat_rate.rate}%</span></div>}
                  {p.has_degressive_pricing && <Badge variant="secondary" className="text-xs mt-1">Tarif dégressif</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductFormDialog
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Formulaire création / édition d'une prestation
// ===========================================================================

type PriceTierDraft = { from_quantity: string; price: string };

function ProductFormDialog({ product, onClose }: {
  product: Product | null;
  onClose: () => void;
}) {
  const isEdit = product !== null;
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const del = useDeleteProduct();

  const { data: vatRates } = useVatRates();
  const { data: entities } = useEntities();

  // État du formulaire — initialisé depuis le produit en édition
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  // En création, le code s'auto-génère depuis le nom tant que l'utilisateur
  // n'y a pas touché. Dès qu'il édite le champ code à la main, on arrête.
  const [codeEdited, setCodeEdited] = useState(false);
  const [status, setStatus] = useState(product?.status ?? "active");
  const [entityId, setEntityId] = useState<string>(product?.entity_id ? String(product.entity_id) : "none");
  const [type, setType] = useState(product?.type ?? "hourly");
  const [duration, setDuration] = useState<string>(product?.default_duration_minutes != null ? String(product.default_duration_minutes) : "");
  const [price, setPrice] = useState<string>(product?.price != null ? String(product.price) : "");
  const [vatRateId, setVatRateId] = useState<string>(product?.vat_rate_id ? String(product.vat_rate_id) : "none");
  const [amountInclTax, setAmountInclTax] = useState(product?.amount_incl_tax ?? false);
  const [degressive, setDegressive] = useState(product?.has_degressive_pricing ?? false);
  const [specificForbidden, setSpecificForbidden] = useState(product?.specific_rates_forbidden ?? false);
  const [accountingCode, setAccountingCode] = useState(product?.accounting_code ?? "");
  const [chapter, setChapter] = useState(product?.chapter ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [tiers, setTiers] = useState<PriceTierDraft[]>(
    product?.price_tiers?.map((t) => ({ from_quantity: String(t.from_quantity), price: String(t.price) })) ?? []
  );

  const busy = create.isPending || update.isPending || del.isPending;

  const handleSubmit = async () => {
    // Validation métier (jamais de submit disabled — on valide au clic)
    const errors: string[] = [];
    if (!code.trim()) errors.push("Le code est requis.");
    if (!name.trim()) errors.push("Le nom est requis.");
    if (price === "" || isNaN(Number(price)) || Number(price) < 0) errors.push("Le prix doit être un nombre positif.");
    if (degressive) {
      tiers.forEach((t, i) => {
        if (t.from_quantity === "" || isNaN(Number(t.from_quantity))) errors.push(`Palier ${i + 1} : quantité invalide.`);
        if (t.price === "" || isNaN(Number(t.price))) errors.push(`Palier ${i + 1} : prix invalide.`);
      });
    }
    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }

    const payload: Record<string, unknown> = {
      code: code.trim(),
      name: name.trim(),
      status,
      entity_id: entityId === "none" ? null : Number(entityId),
      type,
      default_duration_minutes: duration === "" ? null : Number(duration),
      price: Number(price),
      vat_rate_id: vatRateId === "none" ? null : Number(vatRateId),
      amount_incl_tax: amountInclTax,
      has_degressive_pricing: degressive,
      specific_rates_forbidden: specificForbidden,
      accounting_code: accountingCode.trim() || null,
      chapter: chapter.trim() || null,
      description: description.trim() || null,
      price_tiers: degressive
        ? tiers.map((t) => ({ from_quantity: Number(t.from_quantity), price: Number(t.price) }))
        : [],
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id: product!.id, patch: payload as Partial<Product> });
        toast.success("Prestation mise à jour.");
      } else {
        await create.mutateAsync(payload as Partial<Product>);
        toast.success("Prestation créée.");
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Échec de l'enregistrement.");
    }
  };

  const handleDeactivate = async () => {
    if (!product) return;
    if (!confirm("Désactiver cette prestation ? Elle ne sera plus proposée dans les nouveaux devis.")) return;
    try {
      await del.mutateAsync(product.id);
      toast.success("Prestation désactivée.");
      onClose();
    } catch {
      toast.error("Échec de la désactivation.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la prestation" : "Nouvelle prestation"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identité */}
          <Field label="Nom *">
            <Input
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                // Auto-génère le code depuis le nom (création uniquement,
                // tant que l'utilisateur n'a pas modifié le code à la main).
                if (! isEdit && ! codeEdited) setCode(generateCode(v));
              }}
              placeholder="ex : Nettoyage de bureaux"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Code *">
              <Input
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeEdited(true); }}
                placeholder="généré automatiquement"
              />
              {! isEdit && (
                <p className="text-[11px] text-muted-foreground">
                  Référence unique — générée depuis le nom, modifiable.
                </p>
              )}
            </Field>
            <Field label="Statut">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Classification */}
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Entité (vide = global)">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Global —</SelectItem>
                {entities?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {/* Tarification */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix *">
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="TVA">
              <Select value={vatRateId} onValueChange={setVatRateId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune —</SelectItem>
                  {vatRates?.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.label} ({v.rate}%)</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Durée standard (min)">
              <Input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={amountInclTax} onCheckedChange={(v) => setAmountInclTax(v === true)} />
                Prix saisi en TTC
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={specificForbidden} onCheckedChange={(v) => setSpecificForbidden(v === true)} />
                Tarifs spécifiques interdits
              </label>
            </div>
          </div>

          {/* Tarif dégressif */}
          <div className="rounded-lg border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={degressive} onCheckedChange={(v) => setDegressive(v === true)} />
              Tarif dégressif (paliers selon quantité)
            </label>
            {degressive && (
              <div className="space-y-2 pt-1">
                {tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="number" step="0.01" min="0" placeholder="À partir de (qté)"
                      value={t.from_quantity}
                      onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, from_quantity: e.target.value } : x))}
                    />
                    <Input
                      type="number" step="0.01" min="0" placeholder="Prix à ce palier"
                      value={t.price}
                      onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                    />
                    <button
                      type="button"
                      onClick={() => setTiers((arr) => arr.filter((_, j) => j !== i))}
                      className="text-destructive hover:bg-destructive/10 p-2 rounded shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setTiers((arr) => [...arr, { from_quantity: "", price: "" }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un palier
                </Button>
              </div>
            )}
          </div>

          {/* Comptabilité */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code comptable">
              <Input value={accountingCode} onChange={(e) => setAccountingCode(e.target.value)} />
            </Field>
            <Field label="Chapitre">
              <Input value={chapter} onChange={(e) => setChapter(e.target.value)} />
            </Field>
          </div>

          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit && product?.status === "active" && (
            <Button variant="ghost" onClick={handleDeactivate} disabled={busy} className="text-destructive mr-auto">
              Désactiver
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {isEdit ? "Enregistrer" : "Créer la prestation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Génère un code de prestation lisible à partir du nom.
 * "Nettoyage de bureaux" → "NETTOYAGE-BUREAUX"
 *  - accents retirés, mise en majuscules
 *  - mots de liaison ignorés (de, des, du, la, le, et…)
 *  - séparateur = tiret, longueur bornée à 48 caractères
 */
function generateCode(name: string): string {
  const stopWords = new Set(["de", "des", "du", "la", "le", "les", "et", "a", "au", "aux", "en", "pour", "sur"]);
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // retire les accents (combining marks)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")                      // garde alphanumérique
    .split(/\s+/)
    .filter((w) => w && ! stopWords.has(w.toLowerCase()))
    .join("-")
    .slice(0, 48);
}
