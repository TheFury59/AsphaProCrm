import { useState } from "react";
import { AlertTriangle, Boxes, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateStockMovement,
  useCreateStockProduct,
  useStockAlerts,
  useStockProducts,
  useSuppliers,
  type StockProduct,
} from "@/hooks/use-operations";
import { apiErrorMessage } from "@/lib/api";

export function StockPage() {
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [movementProduct, setMovementProduct] = useState<StockProduct | null>(null);

  const { data: products, isLoading } = useStockProducts({
    search: search || undefined,
    "filter[low_stock]": lowStockOnly ? 1 : undefined,
    per_page: 100,
  });
  const { data: alerts = [] } = useStockAlerts();

  return (
    <div>
      <PageHeader
        title="Stock par entité"
        description="Produits consommables, mouvements et alertes de réassort."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau produit
              </Button>
            </DialogTrigger>
            <CreateProductDialog onClose={() => setOpenCreate(false)} />
          </Dialog>
        }
      />

      {alerts.length > 0 && (
        <Card className="mb-4 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              {alerts.length} produit{alerts.length > 1 ? "s" : ""} sous le seuil d'alerte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alerts.map((a) => (
                <Badge key={a.id} variant="outline" className="border-orange-400">
                  {a.name} — {a.current_quantity}/{a.alert_threshold}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant={lowStockOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setLowStockOnly((v) => !v)}
        >
          <AlertTriangle className="mr-2 h-3 w-3" />
          Stock bas uniquement
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Seuil</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.data?.map((p) => {
                  const low = p.current_quantity <= p.alert_threshold;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Boxes className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{p.name}</div>
                            {p.reference && (
                              <div className="text-xs text-muted-foreground font-mono">{p.reference}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.category?.label ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.unit}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={low ? "destructive" : "secondary"}>
                          {p.current_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {p.alert_threshold}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setMovementProduct(p)}>
                          Mouvement
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {products?.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                      Aucun produit en stock.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!movementProduct} onOpenChange={(o) => !o && setMovementProduct(null)}>
        {movementProduct && (
          <MovementDialog product={movementProduct} onClose={() => setMovementProduct(null)} />
        )}
      </Dialog>
    </div>
  );
}

function CreateProductDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    entity_id: 1,
    name: "",
    reference: "",
    unit: "unit" as "unit" | "liter" | "kg" | "pack",
    alert_threshold: 10,
    current_quantity: 0,
    purchase_price: "",
    selling_price: "",
    supplier_id: "none",
  });
  const create = useCreateStockProduct();
  const { data: suppliers } = useSuppliers();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation métier : prix optionnels, mais s'ils sont saisis ils doivent
    // être des nombres positifs (submit jamais disabled — on valide au clic).
    const errors: string[] = [];
    if (form.purchase_price !== "" && (isNaN(Number(form.purchase_price)) || Number(form.purchase_price) < 0))
      errors.push("Le prix d'achat doit être un nombre positif.");
    if (form.selling_price !== "" && (isNaN(Number(form.selling_price)) || Number(form.selling_price) < 0))
      errors.push("Le prix de vente doit être un nombre positif.");
    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }

    const payload = {
      entity_id: form.entity_id,
      name: form.name,
      reference: form.reference,
      unit: form.unit,
      alert_threshold: form.alert_threshold,
      current_quantity: form.current_quantity,
      purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
      selling_price: form.selling_price === "" ? null : Number(form.selling_price),
      supplier_id: form.supplier_id === "none" ? null : Number(form.supplier_id),
    };

    create.mutate(payload, {
      onSuccess: () => {
        toast.success("Produit créé");
        onClose();
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Nouveau produit en stock</DialogTitle>
          <DialogDescription>Ajouter un consommable au stock d'une entité.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid gap-1">
            <Label>Nom *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label>Référence</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Unité</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => setForm({ ...form, unit: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Unité</SelectItem>
                  <SelectItem value="liter">Litre</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Entité ID</Label>
              <Input
                type="number"
                required
                value={form.entity_id}
                onChange={(e) => setForm({ ...form, entity_id: +e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Quantité initiale</Label>
              <Input
                type="number"
                min={0}
                required
                value={form.current_quantity}
                onChange={(e) => setForm({ ...form, current_quantity: +e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>Seuil d'alerte</Label>
              <Input
                type="number"
                min={0}
                required
                value={form.alert_threshold}
                onChange={(e) => setForm({ ...form, alert_threshold: +e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Prix d'achat (€)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="—"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>Prix de vente (€)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="—"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Fournisseur</Label>
            <Select
              value={form.supplier_id}
              onValueChange={(v) => setForm({ ...form, supplier_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun —</SelectItem>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MovementDialog({ product, onClose }: { product: StockProduct; onClose: () => void }) {
  const [movement_type, setType] = useState<"in" | "out" | "adjustment">("in");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>("");
  const create = useCreateStockMovement();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { productId: product.id, payload: { movement_type, quantity, reason: reason || undefined } },
      {
        onSuccess: () => {
          toast.success("Mouvement enregistré");
          onClose();
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Mouvement de stock — {product.name}</DialogTitle>
          <DialogDescription>
            Stock actuel : <strong>{product.current_quantity}</strong> {product.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid gap-1">
            <Label>Type</Label>
            <Select value={movement_type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">
                  <span className="flex items-center gap-2"><TrendingUp className="h-3 w-3" />Entrée</span>
                </SelectItem>
                <SelectItem value="out">
                  <span className="flex items-center gap-2"><TrendingDown className="h-3 w-3" />Sortie</span>
                </SelectItem>
                <SelectItem value="adjustment">Ajustement (qté cible)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>{movement_type === "adjustment" ? "Nouvelle quantité" : "Quantité"}</Label>
            <Input
              type="number"
              min={movement_type === "adjustment" ? 0 : 1}
              required
              value={quantity}
              onChange={(e) => setQuantity(+e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label>Motif</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reorder">Réassort</SelectItem>
                <SelectItem value="usage">Utilisation</SelectItem>
                <SelectItem value="loss">Perte / casse</SelectItem>
                <SelectItem value="inventory_adjustment">Ajustement inventaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
