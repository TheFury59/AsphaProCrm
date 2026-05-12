import { useState } from "react";
import { Plus, Trash2, FileDown, Cloud, CloudCheck } from "lucide-react";
import { useInvoices, useCreateInvoice } from "@/hooks/use-phase3";
import { useSyncInvoicePennylane } from "@/hooks/use-payments";
import { toast } from "sonner";
import { useClients } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  cancelled: "destructive",
  loss: "destructive",
};

const PAY_STATUS_LABEL: Record<string, string> = {
  unpaid: "Non payé", partial: "Partiel", paid: "Payé", loss: "Perte",
};

export function InvoicesListPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useInvoices({ page, per_page: 25 });
  const syncPennylane = useSyncInvoicePennylane();

  const handleSync = async (invoiceId: number) => {
    try {
      const res = await syncPennylane.mutateAsync(invoiceId);
      toast.success(
        res.mock
          ? `Facture synchronisée (mock — clé Pennylane absente). ID: ${res.pennylane_id}`
          : `Facture synchronisée sur Pennylane (ID: ${res.pennylane_id})`
      );
    } catch (e: any) {
      toast.error("Échec de synchronisation Pennylane");
    }
  };

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Émission de factures — format Factur-X obligatoire au 1er septembre"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle facture
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="w-32">Factur-X</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {(data as any)?.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Aucune facture. Crée la première avec « Nouvelle facture ».
                  </TableCell>
                </TableRow>
              )}
              {(data as any)?.data?.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.reference}</TableCell>
                  <TableCell className="font-medium">{inv.client?.client_companies?.[0]?.company_name ?? `Client #${inv.client_id}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.invoice_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.due_date ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{Number(inv.total).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.payment_status === "paid" ? "default" : inv.payment_status === "loss" ? "destructive" : "secondary"}>
                      {PAY_STATUS_LABEL[inv.payment_status] ?? inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <a href={`/api/v1/invoices/${inv.id}/facturx`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7 gap-1.5" title="Télécharger Factur-X">
                          <FileDown className="h-3.5 w-3.5" /> PDF
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant={inv.pennylane_synced_at ? "default" : "outline"}
                        className="h-7 gap-1.5"
                        onClick={() => handleSync(inv.id)}
                        disabled={syncPennylane.isPending}
                        title={inv.pennylane_synced_at ? "Re-synchroniser Pennylane" : "Synchroniser Pennylane"}
                      >
                        {inv.pennylane_synced_at ? <CloudCheck className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(data as any)?.meta?.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{(data as any).meta.total} factures · page {(data as any).meta.current_page} / {(data as any).meta.last_page}</span>
          <div className="space-x-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= (data as any).meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <CreateInvoiceDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateInvoice();
  const { data: clientsData } = useClients({ per_page: 100 });
  const [form, setForm] = useState({
    client_id: "",
    entity_id: "1",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
  });
  const [items, setItems] = useState<Array<{ label: string; quantity: string; unit_price: string }>>([
    { label: "", quantity: "1", unit_price: "0" },
  ]);

  const total = items.reduce((sum, it) => sum + parseFloat(it.quantity || "0") * parseFloat(it.unit_price || "0"), 0);

  const addItem = () => setItems((it) => [...it, { label: "", quantity: "1", unit_price: "0" }]);
  const removeItem = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, value: string) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      client_id: parseInt(form.client_id, 10),
      entity_id: parseInt(form.entity_id, 10),
      invoice_date: form.invoice_date,
      due_date: form.due_date || null,
      items: items.map((it) => ({
        label: it.label,
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price),
        item_type: "forfait",
      })),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
              <option value="">— Choisir —</option>
              {clientsData?.data?.map((c: any) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date facture *</Label>
              <Input type="date" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Échéance</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lignes</Label>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_30px] gap-2 items-center">
                <Input placeholder="Désignation" value={it.label} onChange={(e) => updateItem(i, "label", e.target.value)} />
                <Input type="number" step="0.01" placeholder="Qté" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                <Input type="number" step="0.01" placeholder="PU €" value={it.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} />
                <button type="button" onClick={() => removeItem(i)} className="text-destructive p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une ligne
            </Button>
          </div>

          <div className="text-right text-lg font-semibold border-t pt-3">
            Total : {total.toFixed(2)} €
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
