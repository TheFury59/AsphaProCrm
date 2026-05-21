import { useState } from "react";
import { Boxes, Plus, PencilLine, Trash2, Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useStockProductOptions } from "@/hooks/use-operations";
import {
  useMissionStockItems, useCreateMissionStockItem,
  useUpdateMissionStockItem, useDeleteMissionStockItem,
  type MissionStockItem,
} from "@/hooks/use-mission-stock";
import { apiErrorMessage } from "@/lib/api";

/**
 * Zone « Produits / consommables » d'une mission — distincte des prestations
 * contractualisées.
 *
 * RÈGLE MÉTIER (2026-05-21) : ajouter un produit du stock à une mission
 * décompte IMMÉDIATEMENT le stock (mouvement de sortie côté serveur). Le
 * retirer ré-incrémente. Une ligne libre (sans produit) ne touche pas le stock.
 *
 * Deux modes :
 *  - `mode="draft"` : la mission n'existe pas encore (CreateMissionPage). Les
 *    lignes sont collectées en local ; le parent les persiste après création
 *    de la mission via `getDraftItems()` exposé par `onDraftChange`.
 *  - `mode="live"` : la mission existe (EditMissionPage). Chaque ajout /
 *    modification / suppression déclenche immédiatement la mutation API (et
 *    donc le mouvement de stock).
 */

// Une ligne en cours d'édition (commune aux deux modes).
// `kind` discrimine « produit du stock » vs « ligne libre » (le sélecteur de
// produit n'est rendu que pour une ligne de type `stock`). Non envoyé à l'API.
export type StockLineKind = "stock" | "free";
export type StockItemDraft = {
  kind: StockLineKind;
  stock_product_id: number | null; // null tant qu'aucun produit choisi
  label: string;
  quantity: string;
  unit_price: string;
};

export function emptyStockItemDraft(kind: StockLineKind = "stock"): StockItemDraft {
  return { kind, stock_product_id: null, label: "", quantity: "1", unit_price: "0" };
}

/** Sérialise un draft vers le payload API (nombres + trim). */
export function serializeStockItem(d: StockItemDraft) {
  return {
    stock_product_id: d.stock_product_id,
    label: d.label.trim(),
    quantity: parseFloat(d.quantity || "0"),
    unit_price: parseFloat(d.unit_price || "0"),
  };
}

/** Validation d'une ligne. Retourne la liste des erreurs (vide = OK). */
export function validateStockItem(d: StockItemDraft, prefix = "Produit"): string[] {
  const errs: string[] = [];
  if (d.kind === "stock" && d.stock_product_id == null) {
    errs.push(`${prefix} : choisis un produit du stock (ou utilise une ligne libre).`);
  }
  if (!d.label.trim()) errs.push(`${prefix} : désignation manquante.`);
  const q = parseFloat(d.quantity);
  if (isNaN(q) || q <= 0) errs.push(`${prefix} : quantité invalide.`);
  const u = parseFloat(d.unit_price);
  if (isNaN(u) || u < 0) errs.push(`${prefix} : prix unitaire invalide.`);
  return errs;
}

// =========================================================================
// Mode DRAFT — CreateMissionPage (mission pas encore créée)
// =========================================================================

export function MissionStockSectionDraft({
  items,
  onChange,
}: {
  items: StockItemDraft[];
  onChange: (items: StockItemDraft[]) => void;
}) {
  const { data: stockOptions } = useStockProductOptions();

  const addLine = (kind: StockLineKind) =>
    onChange([...items, emptyStockItemDraft(kind)]);

  const patch = (idx: number, p: Partial<StockItemDraft>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, stockIdStr: string) => {
    const sp = stockOptions?.find((x) => String(x.id) === stockIdStr);
    patch(idx, {
      stock_product_id: sp ? sp.id : null,
      label: sp ? (sp.reference ? `${sp.name} (${sp.reference})` : sp.name) : items[idx].label,
    });
  };

  const subtotal = items.reduce(
    (s, it) => s + parseFloat(it.quantity || "0") * parseFloat(it.unit_price || "0"),
    0,
  );

  return (
    <SectionShell subtotal={subtotal} count={items.length}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => addLine("stock")}>
          <Plus className="h-3.5 w-3.5" /> Produit du stock
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => addLine("free")}>
          <PencilLine className="h-3.5 w-3.5" /> Ligne libre
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground py-3 text-center border rounded-lg border-dashed">
          Aucun produit. Le stock sera décompté à la création de la mission.
        </p>
      )}

      {items.map((it, idx) => (
        <div key={idx} className="rounded-lg border p-2.5 space-y-2">
          <StockLineHeader isStock={it.kind === "stock"} onRemove={() => remove(idx)} />
          {it.kind === "stock" && (
            <Select
              value={it.stock_product_id ? String(it.stock_product_id) : ""}
              onValueChange={(v) => pickProduct(idx, v)}
            >
              <SelectTrigger><SelectValue placeholder="— Choisir un produit du stock —" /></SelectTrigger>
              <SelectContent>
                {(stockOptions ?? []).length === 0 && (
                  <SelectItem value="__none" disabled>Aucun produit en stock actif</SelectItem>
                )}
                {stockOptions?.map((sp) => (
                  <SelectItem key={sp.id} value={String(sp.id)}>
                    {sp.name}{sp.reference ? ` · ${sp.reference}` : ""}
                    <span className="text-muted-foreground ml-1">(stock : {sp.current_quantity})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <StockLineFields draft={it} onPatch={(p) => patch(idx, p)} />
          {it.kind === "stock" && (
            <p className="text-[10px] text-amber-700">
              Le stock de ce produit sera décompté à la création de la mission.
            </p>
          )}
        </div>
      ))}
    </SectionShell>
  );
}

// =========================================================================
// Mode LIVE — EditMissionPage (mission existante, mutations immédiates)
// =========================================================================

export function MissionStockSectionLive({ missionId }: { missionId: number }) {
  const { data: items, isLoading } = useMissionStockItems(missionId);
  const { data: stockOptions } = useStockProductOptions();
  const createItem = useCreateMissionStockItem(missionId);
  const updateItem = useUpdateMissionStockItem(missionId);
  const deleteItem = useDeleteMissionStockItem(missionId);

  // Ligne en cours d'ajout (formulaire inline). null = pas de formulaire.
  const [adding, setAdding] = useState<StockItemDraft | null>(null);
  // Édition d'une ligne existante : id → draft.
  const [editDraft, setEditDraft] = useState<Record<number, StockItemDraft>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const busy = createItem.isPending || updateItem.isPending || deleteItem.isPending;

  const list: MissionStockItem[] = items ?? [];
  const subtotal = list.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0,
  );

  // En mode live, le formulaire d'ajout laisse choisir « ligne libre » OU un
  // produit dans un seul Select : `kind` suit donc la sélection courante.
  const startAdd = () => setAdding(emptyStockItemDraft("free"));

  const pickAddProduct = (stockIdStr: string) => {
    if (!adding) return;
    const sp = stockOptions?.find((x) => String(x.id) === stockIdStr);
    setAdding({
      ...adding,
      kind: sp ? "stock" : "free",
      stock_product_id: sp ? sp.id : null,
      label: sp ? (sp.reference ? `${sp.name} (${sp.reference})` : sp.name) : adding.label,
    });
  };

  const confirmAdd = async () => {
    if (!adding) return;
    const errs = validateStockItem(adding);
    if (errs.length > 0) { toast.error(errs.join(" ")); return; }
    try {
      const res = await createItem.mutateAsync(serializeStockItem(adding));
      toast.success(
        adding.stock_product_id != null
          ? "Produit ajouté — stock décompté."
          : "Ligne libre ajoutée (sans impact stock).",
        { description: res.low_stock ? "⚠ Le produit est désormais sous le seuil d'alerte." : undefined },
      );
      setAdding(null);
    } catch (err) {
      console.error("Ajout produit mission échoué", err);
      toast.error(apiErrorMessage(err, "Échec de l'ajout du produit"));
    }
  };

  const startEdit = (it: MissionStockItem) =>
    setEditDraft((d) => ({
      ...d,
      [it.id]: {
        // `kind` figé sur la nature d'origine de la ligne : on n'autorise pas
        // de basculer stock↔libre en édition (ce serait un changement de
        // sémantique du décompte). On change le produit, la qté, le prix.
        kind: it.stock_product_id != null ? "stock" : "free",
        stock_product_id: it.stock_product_id,
        label: it.label,
        quantity: String(it.quantity),
        unit_price: String(it.unit_price),
      },
    }));

  const cancelEdit = (id: number) =>
    setEditDraft((d) => { const n = { ...d }; delete n[id]; return n; });

  const saveEdit = async (id: number) => {
    const draft = editDraft[id];
    if (!draft) return;
    const errs = validateStockItem(draft);
    if (errs.length > 0) { toast.error(errs.join(" ")); return; }
    setBusyId(id);
    try {
      const res = await updateItem.mutateAsync({ id, ...serializeStockItem(draft) });
      toast.success("Produit mis à jour — stock ajusté.", {
        description: res.low_stock ? "⚠ Le produit est désormais sous le seuil d'alerte." : undefined,
      });
      cancelEdit(id);
    } catch (err) {
      console.error("Maj produit mission échouée", err);
      toast.error(apiErrorMessage(err, "Échec de la mise à jour"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (it: MissionStockItem) => {
    setBusyId(it.id);
    try {
      await deleteItem.mutateAsync(it.id);
      toast.success(
        it.stock_product_id != null
          ? "Produit retiré — stock ré-incrémenté."
          : "Ligne libre retirée.",
      );
    } catch (err) {
      console.error("Suppression produit mission échouée", err);
      toast.error(apiErrorMessage(err, "Échec de la suppression"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionShell subtotal={subtotal} count={list.length}>
      {isLoading && <p className="text-xs text-muted-foreground py-2">Chargement…</p>}

      {/* Lignes existantes */}
      {!isLoading && list.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground py-3 text-center border rounded-lg border-dashed">
          Aucun produit. Ajouter un produit du stock décompte immédiatement le stock.
        </p>
      )}

      {list.map((it) => {
        const draft = editDraft[it.id];
        const lowStock =
          it.stock_product != null &&
          it.stock_product.current_quantity <= 0;
        if (draft) {
          return (
            <div key={it.id} className="rounded-lg border p-2.5 space-y-2 bg-muted/30">
              {it.stock_product_id != null && (
                <Select
                  value={draft.stock_product_id ? String(draft.stock_product_id) : ""}
                  onValueChange={(v) => {
                    const sp = stockOptions?.find((x) => String(x.id) === v);
                    setEditDraft((d) => ({
                      ...d,
                      [it.id]: {
                        ...draft,
                        stock_product_id: sp ? sp.id : null,
                        label: sp ? (sp.reference ? `${sp.name} (${sp.reference})` : sp.name) : draft.label,
                      },
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="— Produit du stock —" /></SelectTrigger>
                  <SelectContent>
                    {stockOptions?.map((sp) => (
                      <SelectItem key={sp.id} value={String(sp.id)}>
                        {sp.name}{sp.reference ? ` · ${sp.reference}` : ""}
                        <span className="text-muted-foreground ml-1">(stock : {sp.current_quantity})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <StockLineFields
                draft={draft}
                onPatch={(p) => setEditDraft((d) => ({ ...d, [it.id]: { ...draft, ...p } }))}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => cancelEdit(it.id)} disabled={busy}>
                  Annuler
                </Button>
                <Button type="button" size="sm" className="gap-1" onClick={() => saveEdit(it.id)} disabled={busy}>
                  {busyId === it.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          );
        }
        return (
          <div key={it.id} className="rounded-lg border p-2.5 flex items-center gap-2">
            {it.stock_product_id != null ? (
              <Badge className="text-[10px] shrink-0 bg-amber-500/15 text-amber-700 border-amber-500/30">
                Stock
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] shrink-0">Libre</Badge>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{it.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {Number(it.quantity)} × {Number(it.unit_price).toFixed(2)} €
                {it.stock_product && (
                  <span className="ml-1.5">
                    · stock restant : {it.stock_product.current_quantity}
                  </span>
                )}
              </p>
            </div>
            {lowStock && (
              <span className="text-amber-600" title="Produit en rupture / sous le seuil">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="text-xs font-semibold tabular-nums">
              {(Number(it.quantity) * Number(it.unit_price)).toFixed(2)} €
            </span>
            <Button
              type="button" size="icon" variant="ghost" className="h-6 w-6"
              onClick={() => startEdit(it)} disabled={busy} title="Modifier"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button" size="icon" variant="ghost"
              className="h-6 w-6 text-rose-600 hover:text-rose-700"
              onClick={() => remove(it)} disabled={busy}
              title={it.stock_product_id != null ? "Retirer — le stock sera ré-incrémenté" : "Retirer"}
            >
              {busyId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        );
      })}

      {/* Formulaire d'ajout inline */}
      {adding ? (
        <div className="rounded-lg border p-2.5 space-y-2 bg-muted/30">
          <p className="text-xs font-medium">Nouveau produit</p>
          <Select
            value={adding.stock_product_id ? String(adding.stock_product_id) : "free"}
            onValueChange={(v) =>
              v === "free"
                ? setAdding({ ...adding, kind: "free", stock_product_id: null })
                : pickAddProduct(v)
            }
          >
            <SelectTrigger><SelectValue placeholder="— Produit du stock —" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">— Ligne libre (sans stock) —</SelectItem>
              {stockOptions?.map((sp) => (
                <SelectItem key={sp.id} value={String(sp.id)}>
                  {sp.name}{sp.reference ? ` · ${sp.reference}` : ""}
                  <span className="text-muted-foreground ml-1">(stock : {sp.current_quantity})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <StockLineFields draft={adding} onPatch={(p) => setAdding({ ...adding, ...p })} />
          {adding.stock_product_id != null && (
            <p className="text-[10px] text-amber-700">
              Le stock de ce produit sera décompté immédiatement.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)} disabled={busy}>
              Annuler
            </Button>
            <Button type="button" size="sm" className="gap-1" onClick={confirmAdd} disabled={busy}>
              {createItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Ajouter
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={startAdd}>
            <Plus className="h-3.5 w-3.5" /> Ajouter un produit / consommable
          </Button>
        </div>
      )}
    </SectionShell>
  );
}

// =========================================================================
// Petits sous-composants partagés
// =========================================================================

function SectionShell({
  subtotal, count, children,
}: { subtotal: number; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary" />
          Produits / consommables ({count})
        </CardTitle>
        <CardDescription>
          Matériel et consommables de la mission. Ajouter un produit du stock
          décompte immédiatement le stock (mouvement de sortie).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {count > 0 && (
          <div className="text-right text-sm font-semibold border-t pt-2">
            Sous-total produits : {subtotal.toFixed(2)} €
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StockLineHeader({ isStock, onRemove }: { isStock: boolean; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {isStock ? (
        <Badge className="text-[10px] shrink-0 bg-amber-500/15 text-amber-700 border-amber-500/30">
          Stock
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px] shrink-0">Libre</Badge>
      )}
      <span className="flex-1" />
      <Button
        type="button" size="icon" variant="ghost"
        className="h-6 w-6 text-rose-600 hover:text-rose-700"
        onClick={onRemove} title="Retirer la ligne"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StockLineFields({
  draft, onPatch,
}: { draft: StockItemDraft; onPatch: (p: Partial<StockItemDraft>) => void }) {
  return (
    <div className="grid grid-cols-[1fr_90px_110px] gap-2">
      <div>
        <Label className="text-[10px]">Désignation *</Label>
        <Input
          value={draft.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="Ex: Sacs poubelle 50L"
        />
      </div>
      <div>
        <Label className="text-[10px]">Quantité *</Label>
        <Input
          type="number" step="0.01" min="0.01"
          value={draft.quantity}
          onChange={(e) => onPatch({ quantity: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-[10px]">Prix unit. €</Label>
        <Input
          type="number" step="0.01" min="0"
          value={draft.unit_price}
          onChange={(e) => onPatch({ unit_price: e.target.value })}
        />
      </div>
    </div>
  );
}
