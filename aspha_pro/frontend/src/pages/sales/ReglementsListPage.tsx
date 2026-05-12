import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useReglements, useCreateReglement, useDeleteReglement } from "@/hooks/use-payments";
import { useClients } from "@/hooks/use-clients";
import { useInvoices } from "@/hooks/use-phase3";
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

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces", check: "Chèque", card: "CB", transfer: "Virement", cesu: "CESU", sepa: "SEPA",
};

const VENT_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  allocated: "default",
  partial: "secondary",
  unallocated: "destructive",
};

export function ReglementsListPage() {
  const [page] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useReglements({ page, per_page: 25 });
  const del = useDeleteReglement();

  return (
    <div>
      <PageHeader
        title="Règlements"
        description="Paiements reçus + ventilations sur factures"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Enregistrer un règlement
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
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Ventilation</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {data?.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Aucun règlement.
                  </TableCell>
                </TableRow>
              )}
              {data?.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="font-medium">{r.client?.client_companies?.[0]?.company_name ?? `#${r.client_id}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.operation_date}</TableCell>
                  <TableCell className="text-right font-medium">{Number(r.amount).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant="outline">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={VENT_VARIANT[r.ventilation_status]}>{r.ventilation_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => del.mutate(r.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateReglementDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateReglementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateReglement();
  const { data: clientsData } = useClients({ per_page: 100 });
  const { data: invoicesData } = useInvoices({ per_page: 100 });

  const [form, setForm] = useState({
    client_id: "",
    entity_id: "1",
    amount: "",
    payment_method: "transfer",
    operation_date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [allocations, setAllocations] = useState<Array<{ invoice_id: string; amount: string }>>([]);

  const clientInvoices = (invoicesData as any)?.data?.filter((inv: any) => inv.client_id === parseInt(form.client_id, 10)) ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      client_id: parseInt(form.client_id, 10),
      entity_id: parseInt(form.entity_id, 10),
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      operation_date: form.operation_date,
      description: form.description || null,
      allocations: allocations
        .filter((a) => a.invoice_id && a.amount)
        .map((a) => ({ invoice_id: parseInt(a.invoice_id, 10), amount: parseFloat(a.amount) })),
    });
    onClose();
    setForm({ client_id: "", entity_id: "1", amount: "", payment_method: "transfer", operation_date: new Date().toISOString().slice(0, 10), description: "" });
    setAllocations([]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Enregistrer un règlement</DialogTitle></DialogHeader>
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
              <Label>Montant € *</Label>
              <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Mode *</Label>
              <select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                {Object.entries(METHOD_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date opération *</Label>
            <Input type="date" value={form.operation_date} onChange={(e) => setForm((f) => ({ ...f, operation_date: e.target.value }))} required />
          </div>

          {form.client_id && clientInvoices.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <Label>Ventiler sur facture(s) (optionnel)</Label>
              {allocations.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_30px] gap-2 items-center">
                  <select value={a.invoice_id} onChange={(e) => {
                    const next = [...allocations]; next[i].invoice_id = e.target.value; setAllocations(next);
                  }} className="rounded-md border bg-background px-2 py-1 text-sm h-9">
                    <option value="">— Facture —</option>
                    {clientInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>{inv.reference} ({inv.total}€)</option>
                    ))}
                  </select>
                  <Input type="number" step="0.01" placeholder="€" value={a.amount} onChange={(e) => {
                    const next = [...allocations]; next[i].amount = e.target.value; setAllocations(next);
                  }} />
                  <button type="button" onClick={() => setAllocations((al) => al.filter((_, idx) => idx !== i))} className="text-destructive">×</button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setAllocations((al) => [...al, { invoice_id: "", amount: "" }])}>
                + Ajouter une ventilation
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
