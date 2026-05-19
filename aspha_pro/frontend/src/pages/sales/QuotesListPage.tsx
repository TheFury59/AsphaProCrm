import { useMemo, useState } from "react";
import {
  Plus, Trash2, Eye, FileText, Cloud, CloudCheck, FileSignature,
  Search, FileSpreadsheet, TrendingUp, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useQuotes, useCreateQuote, useDeleteQuote, useConvertQuoteToInvoice, useQuote,
  type Quote as QuoteType,
} from "@/hooks/use-phase3";
import { useSyncQuotePennylane } from "@/hooks/use-payments";
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
  accepted: "default",
  refused: "destructive",
  expired: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé", expired: "Expiré",
};

export function QuotesListPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading } = useQuotes({
    page,
    per_page: 25,
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const del = useDeleteQuote();
  const convert = useConvertQuoteToInvoice();
  const syncPennylane = useSyncQuotePennylane();

  const rows: QuoteType[] = (data as any)?.data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const acceptedThisMonth = rows.filter((q) => {
      if (q.status !== "accepted") return false;
      if (!q.quote_date) return false;
      const d = new Date(q.quote_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalAccepted = acceptedThisMonth.reduce((s, q) => s + Number(q.total || 0), 0);
    return {
      total: (data as any)?.meta?.total ?? rows.length,
      acceptedThisMonth: acceptedThisMonth.length,
      amountAccepted: totalAccepted,
    };
  }, [rows, data]);

  const handleConvert = async (id: number, ref: string) => {
    if (!confirm(`Convertir le devis ${ref} en facture ?`)) return;
    try {
      const inv = await convert.mutateAsync(id);
      toast.success(`Facture créée : ${inv.reference}`);
    } catch {
      toast.error("Échec de la conversion en facture");
    }
  };

  const handleDelete = async (id: number, ref: string) => {
    if (!confirm(`Supprimer le devis ${ref} ? Cette action est irréversible.`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("Devis supprimé");
    } catch {
      toast.error("Échec de la suppression");
    }
  };

  const handleSync = async (id: number) => {
    try {
      const res = await syncPennylane.mutateAsync(id);
      toast.success(
        res.mock
          ? `Devis synchronisé (mock — Pennylane non configuré). ID: ${res.pennylane_id}`
          : `Devis synchronisé sur Pennylane (ID: ${res.pennylane_id})`
      );
    } catch {
      toast.error("Échec de synchronisation Pennylane");
    }
  };

  return (
    <div>
      <PageHeader
        title="Devis"
        description="Propositions commerciales — gestion complète avec items + conversion en facture"
        actions={
          <Button
            onClick={() => setOpen(true)}
            className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" /> Nouveau devis
          </Button>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Devis au total" value={String(stats.total)} icon={FileSpreadsheet} accent="from-indigo-500/15 to-indigo-500/5" />
        <StatCard label="Acceptés ce mois" value={String(stats.acceptedThisMonth)} icon={CheckCircle2} accent="from-emerald-500/15 to-emerald-500/5" />
        <StatCard
          label="Montant accepté (mois)"
          value={`${stats.amountAccepted.toFixed(2)} €`}
          icon={TrendingUp}
          accent="from-amber-500/15 to-amber-500/5"
        />
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-soft mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Recherche par référence ou client"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer sm:w-48"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
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
                <TableHead>Validité</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Aucun devis. Crée le premier avec « Nouveau devis ».
                  </TableCell>
                </TableRow>
              )}
              {rows.map((q: any) => (
                <TableRow
                  key={q.id}
                  className="hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button,[role='button']")) return;
                    setDetailId(q.id);
                  }}
                >
                  <TableCell className="font-mono text-xs">{q.reference ?? `#${q.id}`}</TableCell>
                  <TableCell className="font-medium">
                    {q.client?.company?.company_name ?? `Client #${q.client_id}`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.quote_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.validity_date ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{Number(q.total ?? 0).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABELS[q.status] ?? q.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer" title="Voir détail"
                        onClick={() => setDetailId(q.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer" title="Convertir en facture"
                        disabled={convert.isPending}
                        onClick={() => handleConvert(q.id, q.reference ?? `#${q.id}`)}>
                        <FileSignature className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={q.pennylane_synced_at ? "default" : "outline"}
                        className="h-7 w-7 p-0 cursor-pointer"
                        onClick={() => handleSync(q.id)}
                        disabled={syncPennylane.isPending}
                        title={q.pennylane_synced_at ? "Re-synchroniser Pennylane" : "Synchroniser Pennylane"}
                      >
                        {q.pennylane_synced_at ? <CloudCheck className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer text-destructive hover:bg-destructive/10" title="Supprimer"
                        disabled={del.isPending}
                        onClick={() => handleDelete(q.id, q.reference ?? `#${q.id}`)}>
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

      {(data as any)?.meta?.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{(data as any).meta.total} devis · page {(data as any).meta.current_page} / {(data as any).meta.last_page}</span>
          <div className="space-x-2">
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={page >= (data as any).meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <CreateQuoteDialog open={open} onClose={() => setOpen(false)} />
      <QuoteDetailDialog id={detailId} onClose={() => setDetailId(null)} />
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

function QuoteDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useQuote(id);

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-2xl">
        <DialogHeader>
          <DialogTitle>Détail du devis {data?.reference ?? ""}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" value={data.client?.company?.company_name ?? `Client #${data.client_id}`} />
              <Field label="Statut" value={STATUS_LABELS[data.status] ?? data.status} />
              <Field label="Date du devis" value={data.quote_date} />
              <Field label="Validité" value={data.validity_date ?? "—"} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Lignes</p>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="text-right w-20">Qté</TableHead>
                      <TableHead className="text-right w-24">PU</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.items ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          Aucune ligne sur ce devis.
                        </TableCell>
                      </TableRow>
                    )}
                    {(data.items ?? []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>{it.label}</TableCell>
                        <TableCell className="text-right">{Number(it.quantity).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(it.unit_price).toFixed(2)} €</TableCell>
                        <TableCell className="text-right font-medium">{Number(it.total).toFixed(2)} €</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right text-base font-semibold mt-2">
                Total : {Number(data.total ?? 0).toFixed(2)} €
              </div>
            </div>

            {data.comment && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Commentaire</p>
                <p className="text-sm">{data.comment}</p>
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

function CreateQuoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateQuote();
  const { data: clientsData } = useClients({ per_page: 100 });
  const [form, setForm] = useState({
    client_id: "",
    entity_id: "1",
    quote_date: new Date().toISOString().slice(0, 10),
    validity_date: "",
    nature: "regular",
  });
  const [items, setItems] = useState<Array<{ label: string; quantity: string; unit_price: string }>>([
    { label: "", quantity: "1", unit_price: "0" },
  ]);

  const total = items.reduce(
    (sum, it) => sum + parseFloat(it.quantity || "0") * parseFloat(it.unit_price || "0"),
    0,
  );

  const addItem = () => setItems((it) => [...it, { label: "", quantity: "1", unit_price: "0" }]);
  const removeItem = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, value: string) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  const reset = () => {
    setForm({
      client_id: "",
      entity_id: "1",
      quote_date: new Date().toISOString().slice(0, 10),
      validity_date: "",
      nature: "regular",
    });
    setItems([{ label: "", quantity: "1", unit_price: "0" }]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        client_id: parseInt(form.client_id, 10),
        entity_id: parseInt(form.entity_id, 10),
        quote_date: form.quote_date,
        validity_date: form.validity_date || null,
        nature: form.nature,
        items: items
          .filter((it) => it.label.trim())
          .map((it) => ({
            label: it.label,
            quantity: parseFloat(it.quantity || "0"),
            unit_price: parseFloat(it.unit_price || "0"),
            item_type: "forfait",
          })),
      });
      toast.success("Devis créé");
      reset();
      onClose();
    } catch {
      toast.error("Échec de la création du devis");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-xl">
        <DialogHeader><DialogTitle>Nouveau devis</DialogTitle></DialogHeader>
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
              <Label>Date du devis *</Label>
              <Input type="date" value={form.quote_date} onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Validité</Label>
              <Input type="date" value={form.validity_date} onChange={(e) => setForm((f) => ({ ...f, validity_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nature</Label>
            <select value={form.nature} onChange={(e) => setForm((f) => ({ ...f, nature: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
              <option value="regular">Régulière</option>
              <option value="punctual">Ponctuelle</option>
            </select>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Lignes
            </Label>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_30px] gap-2 items-center">
                <Input placeholder="Désignation" value={it.label} onChange={(e) => updateItem(i, "label", e.target.value)} />
                <Input type="number" step="0.01" placeholder="Qté" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                <Input type="number" step="0.01" placeholder="PU €" value={it.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} />
                <button type="button" onClick={() => removeItem(i)} className="text-destructive p-1 cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="cursor-pointer">
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une ligne
            </Button>
          </div>

          <div className="text-right text-lg font-semibold border-t pt-3">
            Total : {total.toFixed(2)} €
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Annuler</Button>
            <Button type="submit" disabled={create.isPending}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer">
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
