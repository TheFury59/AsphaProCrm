import { useMemo, useState } from "react";

/**
 * 2026-06-24 — formatage YYYY-MM-DD → DD/MM/YYYY pour les dates de factures.
 * Robust : si on reçoit accidentellement un ISO datetime (`T22:00:00Z`),
 * on extrait la partie date via regex au lieu de `new Date()` qui re-décale
 * le fuseau et peut donner J-1 près de minuit.
 */
function fmtDateFr(d: string | null | undefined): string {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
}
import {
  Plus, Trash2, FileDown, Cloud, CloudCheck, Eye, Search,
  Receipt, Wallet, Hourglass, Undo2, Send,
} from "lucide-react";
import {
  useInvoices, useCreateInvoice, useDeleteInvoice, useInvoice, useUpdateInvoice,
  type Invoice as InvoiceType,
} from "@/hooks/use-phase3";
import { useSyncInvoicePennylane } from "@/hooks/use-payments";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { useClients } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Émise", cancelled: "Annulée", loss: "Perte",
};

const PAY_STATUS_LABEL: Record<string, string> = {
  unpaid: "Non payé", partial: "Partiel", paid: "Payé", loss: "Perte",
};

export function InvoicesListPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading } = useInvoices({
    page,
    per_page: 25,
    search: search || undefined,
    status: statusFilter || undefined,
    payment_status: paymentFilter || undefined,
  });
  const syncPennylane = useSyncInvoicePennylane();
  const del = useDeleteInvoice();
  const update = useUpdateInvoice(); // 2026-06-24 — pour annuler (sent → cancelled)

  const rows: InvoiceType[] = (data as any)?.data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const totalAmount = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const unpaidAmount = rows
      .filter((r) => r.payment_status !== "paid" && r.payment_status !== "loss")
      .reduce((s, r) => s + Number(r.total || 0), 0);
    const paidThisMonth = rows.filter((r) => {
      if (r.payment_status !== "paid") return false;
      if (!r.invoice_date) return false;
      const d = new Date(r.invoice_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((s, r) => s + Number(r.total || 0), 0);
    return { totalAmount, unpaidAmount, paidThisMonth };
  }, [rows]);

  const handleSync = async (invoiceId: number) => {
    try {
      const res = await syncPennylane.mutateAsync(invoiceId);
      toast.success(
        res.mock
          ? `Facture synchronisée (mock — Pennylane non configuré). ID: ${res.pennylane_id}`
          : `Facture synchronisée sur Pennylane (ID: ${res.pennylane_id})`
      );
    } catch {
      toast.error("Échec de synchronisation Pennylane");
    }
  };

  // 2026-05-20 PDF B2B — download du PDF facture (Factur-X : PDF + XML CII embarqué)
  // via blob pour préserver l'auth Sanctum, au lieu d'un <a href> direct qui la perd.
  const handleDownloadPdf = async (id: number, ref: string) => {
    try {
      const res = await api.get(`/invoices/${id}/facturx`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ref ?? `INV-${id}`}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Téléchargement PDF facture échoué", e?.response ?? e);
      toast.error("Échec du téléchargement du PDF");
    }
  };

  const handleDelete = async (id: number, ref: string) => {
    if (!confirm(`Supprimer la facture ${ref} ? Cette action est irréversible.`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("Facture supprimée");
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Échec de la suppression";
      toast.error(msg);
    }
  };

  // 2026-06-24 — annuler une facture émise : status sent → cancelled.
  // Une facture annulée n'est plus « active » (disparaît de l'extranet
  // client), et devient supprimable (le backend n'autorise le delete que
  // sur draft/cancelled).
  const handleCancel = async (id: number, ref: string) => {
    if (!confirm(`Annuler la facture ${ref} ? Elle ne sera plus visible côté client et pourra ensuite être supprimée.`)) return;
    try {
      await update.mutateAsync({ id, patch: { status: "cancelled" } });
      toast.success("Facture annulée");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Échec de l'annulation"));
    }
  };

  // 2026-06-24 — (ré)émettre une facture : draft OU cancelled → sent.
  // Après annulation + correction, on peut la ré-envoyer au client.
  const handleSend = async (id: number, ref: string, wasCancelled: boolean) => {
    const verb = wasCancelled ? "Ré-émettre" : "Émettre";
    if (!confirm(`${verb} la facture ${ref} ? Elle sera visible côté client et le client sera notifié.`)) return;
    try {
      await update.mutateAsync({ id, patch: { status: "sent" } });
      toast.success(wasCancelled ? "Facture ré-émise au client" : "Facture émise au client");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Échec de l'envoi"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Émission de factures — format Factur-X obligatoire au 1er septembre"
        actions={
          <Button
            onClick={() => setOpen(true)}
            className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" /> Nouvelle facture
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total facturé" value={`${stats.totalAmount.toFixed(2)} €`} icon={Receipt} accent="from-indigo-500/15 to-indigo-500/5" />
        <StatCard label="En attente de paiement" value={`${stats.unpaidAmount.toFixed(2)} €`} icon={Hourglass} accent="from-amber-500/15 to-amber-500/5" />
        <StatCard label="Payé ce mois" value={`${stats.paidThisMonth.toFixed(2)} €`} icon={Wallet} accent="from-emerald-500/15 to-emerald-500/5" />
      </div>

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
              className="rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer sm:w-40"
            >
              <option value="">Tous statuts</option>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
              className="rounded-md border bg-background px-3 py-2 text-sm h-9 cursor-pointer sm:w-44"
            >
              <option value="">Tous paiements</option>
              {Object.entries(PAY_STATUS_LABEL).map(([k, label]) => (
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
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Aucune facture. Crée la première avec « Nouvelle facture ».
                  </TableCell>
                </TableRow>
              )}
              {rows.map((inv: any) => (
                <TableRow
                  key={inv.id}
                  className="hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button,[role='button']")) return;
                    setDetailId(inv.id);
                  }}
                >
                  <TableCell className="font-mono text-xs">{inv.reference}</TableCell>
                  <TableCell className="font-medium">{inv.client?.company?.company_name ?? `Client #${inv.client_id}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDateFr(inv.invoice_date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDateFr(inv.due_date)}</TableCell>
                  <TableCell className="text-right font-medium">{Number(inv.total).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.payment_status === "paid" ? "default" : inv.payment_status === "loss" ? "destructive" : "secondary"}>
                      {PAY_STATUS_LABEL[inv.payment_status] ?? inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer" title="Voir détail"
                        onClick={() => setDetailId(inv.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {/* 2026-05-20 PDF B2B — blob download (préserve l'auth Sanctum) */}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer" title="Télécharger PDF Factur-X"
                        onClick={() => handleDownloadPdf(inv.id, inv.reference)}>
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={inv.pennylane_synced_at ? "default" : "outline"}
                        className="h-7 w-7 p-0 cursor-pointer"
                        onClick={() => handleSync(inv.id)}
                        disabled={syncPennylane.isPending}
                        title={inv.pennylane_synced_at ? "Re-synchroniser Pennylane" : "Synchroniser Pennylane"}
                      >
                        {inv.pennylane_synced_at ? <CloudCheck className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
                      </Button>
                      {/* 2026-06-24 — (ré)émettre : brouillon ou facture annulée */}
                      {(inv.status === "draft" || inv.status === "cancelled") && (
                        <Button size="sm" variant="outline"
                          className="h-7 w-7 p-0 cursor-pointer text-indigo-600 hover:bg-indigo-500/10"
                          title={inv.status === "cancelled" ? "Ré-émettre au client" : "Émettre au client"}
                          disabled={update.isPending}
                          onClick={() => handleSend(inv.id, inv.reference, inv.status === "cancelled")}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* 2026-06-24 — annuler une facture émise (sent → cancelled) */}
                      {inv.status === "sent" && (
                        <Button size="sm" variant="outline"
                          className="h-7 w-7 p-0 cursor-pointer text-amber-600 hover:bg-amber-500/10"
                          title="Annuler la facture"
                          disabled={update.isPending}
                          onClick={() => handleCancel(inv.id, inv.reference)}>
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer text-destructive hover:bg-destructive/10"
                        title={inv.status === "sent" ? "Annule la facture d'abord pour pouvoir la supprimer" : "Supprimer"}
                        disabled={del.isPending}
                        onClick={() => handleDelete(inv.id, inv.reference)}>
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
          <span>{(data as any).meta.total} factures · page {(data as any).meta.current_page} / {(data as any).meta.last_page}</span>
          <div className="space-x-2">
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={page >= (data as any).meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <CreateInvoiceDialog open={open} onClose={() => setOpen(false)} />
      <InvoiceDetailDialog id={detailId} onClose={() => setDetailId(null)} />
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

function InvoiceDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useInvoice(id);
  const update = useUpdateInvoice();
  const del = useDeleteInvoice(); // 2026-06-24 — supprimer depuis le détail

  const cancelInvoice = async () => {
    if (!data) return;
    if (!confirm(`Annuler la facture ${data.reference} ? Elle ne sera plus visible côté client et pourra ensuite être supprimée.`)) return;
    try {
      await update.mutateAsync({ id: data.id, patch: { status: "cancelled" } });
      toast.success("Facture annulée");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de l'annulation"));
    }
  };

  const deleteInvoice = async () => {
    if (!data) return;
    if (!confirm(`Supprimer définitivement la facture ${data.reference} ? Cette action est irréversible.`)) return;
    try {
      await del.mutateAsync(data.id);
      toast.success("Facture supprimée");
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de la suppression"));
    }
  };

  // 2026-06-24 — édition des notes + dates tant que la facture est en
  // BROUILLON (status draft). Une fois émise (sent), plus aucune
  // modification autorisée (obligation comptable : facture figée).
  const [editing, setEditing] = useState(false);
  const [editComment, setEditComment] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [editInvoiceDate, setEditInvoiceDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const isDraft = data?.status === "draft";
  // 2026-06-24 — une facture ANNULÉE redevient éditable comme un brouillon
  // (choix métier : on peut la corriger puis la ré-émettre). Une facture
  // « sent » reste figée (obligation comptable).
  const isEditable = data?.status === "draft" || data?.status === "cancelled";

  const startEdit = () => {
    if (!data) return;
    setEditComment(data.comment ?? "");
    setEditInternalNotes((data as any).internal_notes ?? "");
    setEditInvoiceDate((data.invoice_date ?? "").slice(0, 10));
    setEditDueDate((data.due_date ?? "").slice(0, 10));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!data) return;
    try {
      await update.mutateAsync({
        id: data.id,
        patch: {
          invoice_date: editInvoiceDate || undefined,
          due_date: editDueDate || null,
          comment: editComment.trim() || null,
          internal_notes: editInternalNotes.trim() || null,
        },
      });
      toast.success("Facture mise à jour");
      setEditing(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de la mise à jour"));
    }
  };

  // 2026-05-21 — envoyer la facture au client (draft → sent). Une fois
  // émise, elle devient visible sur l'extranet client + le client est
  // notifié (InvoiceObserver).
  const sendToClient = async () => {
    if (!data) return;
    try {
      await update.mutateAsync({ id: data.id, patch: { status: "sent" } });
      toast.success("Facture envoyée au client");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de l'envoi de la facture"));
    }
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* 2026-06-24 — max-h + scroll si descriptif long. */}
      <DialogContent className="sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Facture {data?.reference ?? ""}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" value={data.client?.company?.company_name ?? `Client #${data.client_id}`} />
              <Field label="Statut" value={STATUS_LABELS[data.status] ?? data.status} />
              {editing ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date facture</Label>
                    <Input type="date" value={editInvoiceDate} onChange={(e) => setEditInvoiceDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Échéance</Label>
                    <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <Field label="Date" value={fmtDateFr(data.invoice_date)} />
                  <Field label="Échéance" value={fmtDateFr(data.due_date)} />
                </>
              )}
              <Field label="Paiement" value={PAY_STATUS_LABEL[data.payment_status] ?? data.payment_status} />
              <Field label="Total HT" value={`${Number(data.total).toFixed(2)} €`} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Lignes</p>
              {/* 2026-06-24 — table-fixed + break-words sur Désignation
                  pour qu'une désignation très longue (ex: une adresse
                  complète) ne pousse plus les colonnes Qté/PU/Total
                  hors du dialog. */}
              <div className="rounded-lg border overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="text-right w-16">Qté</TableHead>
                      <TableHead className="text-right w-24">PU</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.invoice_items ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          Aucune ligne.
                        </TableCell>
                      </TableRow>
                    )}
                    {(data.invoice_items ?? []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="break-words whitespace-normal">{it.label}</TableCell>
                        <TableCell className="text-right">{Number(it.quantity).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(it.unit_price).toFixed(2)} €</TableCell>
                        <TableCell className="text-right font-medium">{Number(it.total).toFixed(2)} €</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 2026-06-24 — Description (visible client) + note interne (admin).
                Éditables en mode `editing` (brouillon uniquement). */}
            {editing ? (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-emerald-600 mb-1 block">
                    Description (visible sur le PDF client)
                  </Label>
                  <Textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    rows={4}
                    placeholder="Ex : prestation réalisée du 1er au 15 du mois…"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-amber-600 mb-1 block">
                    Note interne (jamais visible client)
                  </Label>
                  <Textarea
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                    rows={3}
                    placeholder="Ex : relancer si non payé sous 15j, litige en cours…"
                  />
                </div>
              </div>
            ) : (
              (data.comment || (data as any).internal_notes) && (
                <div className="space-y-2">
                  {data.comment && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-emerald-600 mb-1">
                        Description (visible sur le PDF client)
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-2 max-h-64 overflow-y-auto">
                        {data.comment}
                      </p>
                    </div>
                  )}
                  {(data as any).internal_notes && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-amber-600 mb-1">
                        Note interne (jamais visible client)
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 max-h-64 overflow-y-auto">
                        {(data as any).internal_notes}
                      </p>
                    </div>
                  )}
                </div>
              )
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Règlements ventilés</p>
              {(data.reglement_invoice_lines ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun règlement ventilé sur cette facture.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Règlement</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right w-28">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.reglement_invoice_lines ?? []).map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-mono text-xs">{line.reglement?.reference ?? `#${line.reglement_id}`}</TableCell>
                          <TableCell>{line.reglement?.operation_date ?? "—"}</TableCell>
                          <TableCell>{line.reglement?.payment_method ?? "—"}</TableCell>
                          <TableCell className="text-right font-medium">{Number(line.allocated_amount).toFixed(2)} €</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={update.isPending} className="cursor-pointer">
                Annuler
              </Button>
              <Button
                onClick={saveEdit}
                disabled={update.isPending}
                className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer"
              >
                {update.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="cursor-pointer">Fermer</Button>
              {/* 2026-06-24 — annuler une facture émise (sent → cancelled),
                  la rend supprimable + la retire de l'extranet client. */}
              {data?.status === "sent" && (
                <Button
                  variant="outline"
                  onClick={cancelInvoice}
                  disabled={update.isPending}
                  className="cursor-pointer text-amber-700 hover:bg-amber-500/10"
                >
                  Annuler la facture
                </Button>
              )}
              {/* Supprimer : uniquement brouillon ou annulée (garde-fou
                  comptable côté backend aussi). */}
              {(data?.status === "draft" || data?.status === "cancelled") && (
                <Button
                  variant="outline"
                  onClick={deleteInvoice}
                  disabled={del.isPending}
                  className="cursor-pointer text-destructive hover:bg-destructive/10"
                >
                  Supprimer
                </Button>
              )}
              {/* 2026-06-24 — édition autorisée sur brouillon OU facture
                  annulée (facture émise = figée, obligation comptable). */}
              {isEditable && (
                <Button variant="outline" onClick={startEdit} className="cursor-pointer">
                  Modifier
                </Button>
              )}
              {(data?.status === "draft" || data?.status === "cancelled") && (
                <Button
                  onClick={sendToClient}
                  disabled={update.isPending}
                  className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer"
                >
                  {update.isPending
                    ? "Envoi…"
                    : data?.status === "cancelled" ? "Ré-émettre au client" : "Envoyer au client"}
                </Button>
              )}
            </>
          )}
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

function CreateInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateInvoice();
  const { data: clientsData } = useClients({ per_page: 100 });
  // entity_id n'est plus saisi ni envoyé : le backend le dérive du client.
  const [form, setForm] = useState({
    client_id: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    // 2026-06-24 — 2 champs notes (comme les devis) : `comment` visible
    // sur le PDF client, `internal_notes` jamais sur le PDF (admin only).
    comment: "",
    internal_notes: "",
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        client_id: parseInt(form.client_id, 10),
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        comment: form.comment.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        items: items
          .filter((it) => it.label.trim())
          .map((it) => ({
            label: it.label,
            quantity: parseFloat(it.quantity),
            unit_price: parseFloat(it.unit_price),
            item_type: "forfait",
          })),
      });
      toast.success("Facture créée");
      setForm({ client_id: "", invoice_date: new Date().toISOString().slice(0, 10), due_date: "", comment: "", internal_notes: "" });
      setItems([{ label: "", quantity: "1", unit_price: "0" }]);
      onClose();
    } catch {
      toast.error("Échec de la création");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-xl">
        <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
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
              <Label>Date facture *</Label>
              <Input type="date" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Échéance</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label>Lignes</Label>
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

          <div className="space-y-1.5 border-t pt-3">
            <Label className="text-xs text-muted-foreground">
              Description <span className="text-[10px] text-emerald-600">— visible sur le PDF envoyé au client</span>
            </Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              rows={2}
              placeholder="Ex : prestation réalisée du 1er au 15 du mois…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Note interne <span className="text-[10px] text-amber-600">— JAMAIS visible côté client, admins uniquement</span>
            </Label>
            <Textarea
              value={form.internal_notes}
              onChange={(e) => setForm((f) => ({ ...f, internal_notes: e.target.value }))}
              rows={2}
              placeholder="Ex : relancer si non payé sous 15j, litige en cours…"
            />
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
