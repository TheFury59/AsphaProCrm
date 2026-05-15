import { useMemo, useState } from "react";
import {
  Plus, Trash2, Eye, Search, Banknote, CircleSlash, CircleCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useReglements, useCreateReglement, useDeleteReglement, useReglement, useAllocateReglement,
} from "@/hooks/use-payments";
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

const VENT_LABELS: Record<string, string> = {
  unallocated: "Non ventilé", partial: "Partiel", allocated: "Ventilé",
};

const VENT_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  allocated: "default",
  partial: "secondary",
  unallocated: "destructive",
};

export function ReglementsListPage() {
  const [page] = useState(1);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [ventFilter, setVentFilter] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading } = useReglements({
    page, per_page: 25,
    search: search || undefined,
    payment_method: methodFilter || undefined,
    ventilation_status: ventFilter || undefined,
  });
  const del = useDeleteReglement();

  const rows = data?.data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthTotal = rows
      .filter((r) => {
        if (!r.operation_date) return false;
        const d = new Date(r.operation_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const unallocated = rows.filter((r) => r.ventilation_status === "unallocated").length;
    const allocated = rows.filter((r) => r.ventilation_status === "allocated").length;
    return { monthTotal, unallocated, allocated };
  }, [rows]);

  const handleDelete = async (id: number, ref: string) => {
    if (!confirm(`Supprimer le règlement ${ref} ?`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("Règlement supprimé");
    } catch {
      toast.error("Échec de la suppression");
    }
  };

  return (
    <div>
      <PageHeader
        title="Règlements"
        description="Paiements reçus + ventilations sur factures"
        actions={
          <Button onClick={() => setOpen(true)}
            className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer">
            <Plus className="h-4 w-4 mr-2" /> Enregistrer un règlement
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Encaissé ce mois" value={`${stats.monthTotal.toFixed(2)} €`} icon={Banknote} accent="from-emerald-500/15 to-emerald-500/5" />
        <StatCard label="Non ventilés" value={String(stats.unallocated)} icon={CircleSlash} accent="from-rose-500/15 to-rose-500/5" />
        <StatCard label="Ventilés" value={String(stats.allocated)} icon={CircleCheck} accent="from-indigo-500/15 to-indigo-500/5" />
      </div>

      <Card className="rounded-2xl shadow-soft mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Recherche par référence ou client"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer sm:w-44">
              <option value="">Tous modes</option>
              {Object.entries(METHOD_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select value={ventFilter} onChange={(e) => setVentFilter(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer sm:w-48">
              <option value="">Toutes ventilations</option>
              {Object.entries(VENT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft">
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
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Aucun règlement.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="font-medium">{r.client?.company?.company_name ?? `#${r.client_id}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.operation_date}</TableCell>
                  <TableCell className="text-right font-medium">{Number(r.amount).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant="outline">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={VENT_VARIANT[r.ventilation_status]}>{VENT_LABELS[r.ventilation_status] ?? r.ventilation_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer" title="Voir détail"
                        onClick={() => setDetailId(r.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer text-destructive hover:bg-destructive/10" title="Supprimer"
                        disabled={del.isPending}
                        onClick={() => handleDelete(r.id, r.reference)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateReglementDialog open={open} onClose={() => setOpen(false)} />
      <ReglementDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${accent} shadow-soft p-5 border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
        <div className="rounded-xl bg-white/60 dark:bg-black/20 p-2.5">
          <Icon className="h-5 w-5 text-foreground/80" />
        </div>
      </div>
    </div>
  );
}

function ReglementDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useReglement(id);
  const allocate = useAllocateReglement();
  const { data: invoicesData } = useInvoices({ per_page: 100 });
  const [newAlloc, setNewAlloc] = useState({ invoice_id: "", amount: "" });

  const clientId = data?.client_id;
  const clientInvoices: any[] = ((invoicesData as any)?.data ?? []).filter((inv: any) => inv.client_id === clientId);

  const totalAllocated = (data?.reglement_invoice_lines ?? []).reduce((s, l) => s + Number(l.allocated_amount || 0), 0);
  const remaining = data ? Math.max(0, Number(data.amount) - totalAllocated) : 0;

  const handleAllocate = async () => {
    if (!data) return;
    const amount = parseFloat(newAlloc.amount);
    const invoice_id = parseInt(newAlloc.invoice_id, 10);
    if (!invoice_id || !amount || amount <= 0) {
      toast.error("Sélectionne une facture et un montant > 0");
      return;
    }
    try {
      await allocate.mutateAsync({ reglementId: data.id, invoice_id, amount });
      toast.success("Ventilation ajoutée");
      setNewAlloc({ invoice_id: "", amount: "" });
    } catch {
      toast.error("Échec de la ventilation");
    }
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-2xl">
        <DialogHeader>
          <DialogTitle>Règlement {data?.reference ?? ""}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" value={data.client?.company?.company_name ?? `#${data.client_id}`} />
              <Field label="Mode" value={METHOD_LABELS[data.payment_method] ?? data.payment_method} />
              <Field label="Date opération" value={data.operation_date} />
              <Field label="Montant" value={`${Number(data.amount).toFixed(2)} €`} />
              <Field label="Ventilation" value={VENT_LABELS[data.ventilation_status] ?? data.ventilation_status} />
              <Field label="Reste à ventiler" value={`${remaining.toFixed(2)} €`} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Ventilations sur factures</p>
              {(data.reglement_invoice_lines ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune ventilation pour l'instant.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Facture</TableHead>
                        <TableHead className="text-right w-32">Total facture</TableHead>
                        <TableHead className="text-right w-32">Ventilé</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.reglement_invoice_lines ?? []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">{l.invoice?.reference ?? `#${l.invoice_id}`}</TableCell>
                          <TableCell className="text-right">{l.invoice ? `${Number(l.invoice.total).toFixed(2)} €` : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{Number(l.allocated_amount).toFixed(2)} €</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {remaining > 0.01 && clientInvoices.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ajouter une ventilation</Label>
                <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <select value={newAlloc.invoice_id}
                    onChange={(e) => setNewAlloc((f) => ({ ...f, invoice_id: e.target.value }))}
                    className="rounded-md border bg-background px-2 py-2 text-sm h-9 cursor-pointer">
                    <option value="">— Facture —</option>
                    {clientInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>{inv.reference} ({Number(inv.total).toFixed(2)} €)</option>
                    ))}
                  </select>
                  <Input type="number" step="0.01" min="0.01" placeholder="€"
                    value={newAlloc.amount}
                    onChange={(e) => setNewAlloc((f) => ({ ...f, amount: e.target.value }))} />
                  <Button onClick={handleAllocate} disabled={allocate.isPending}
                    className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer">
                    Ventiler
                  </Button>
                </div>
              </div>
            )}

            {data.description && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{data.description}</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
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

  const reset = () => {
    setForm({ client_id: "", entity_id: "1", amount: "", payment_method: "transfer", operation_date: new Date().toISOString().slice(0, 10), description: "" });
    setAllocations([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
      toast.success("Règlement enregistré");
      reset();
      onClose();
    } catch {
      toast.error("Échec de l'enregistrement");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-lg">
        <DialogHeader><DialogTitle>Enregistrer un règlement</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer" required>
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
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
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
                  }} className="rounded-md border bg-background px-2 py-1 text-sm h-9 cursor-pointer">
                    <option value="">— Facture —</option>
                    {clientInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>{inv.reference} ({inv.total}€)</option>
                    ))}
                  </select>
                  <Input type="number" step="0.01" placeholder="€" value={a.amount} onChange={(e) => {
                    const next = [...allocations]; next[i].amount = e.target.value; setAllocations(next);
                  }} />
                  <button type="button" onClick={() => setAllocations((al) => al.filter((_, idx) => idx !== i))} className="text-destructive cursor-pointer">×</button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className="cursor-pointer"
                onClick={() => setAllocations((al) => [...al, { invoice_id: "", amount: "" }])}>
                + Ajouter une ventilation
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Annuler</Button>
            <Button type="submit" disabled={create.isPending}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer">
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
