import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

/**
 * 2026-06-24 — formatage YYYY-MM-DD → DD/MM/YYYY pour les dates de devis.
 * Robust : extrait la partie date via regex pour tolérer un ISO datetime
 * accidentel (`T22:00:00Z`) renvoyé par l'API.
 */
function fmtDateFr(d: string | null | undefined): string {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
}
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, Eye, Cloud, CloudCheck, FileSignature,
  Search, FileSpreadsheet, TrendingUp, CheckCircle2, FileDown,
  Settings2, PackagePlus, PencilLine, Layers, Briefcase, Loader2,
  Boxes, Send, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  useQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, useConvertQuoteToInvoice,
  useConvertQuoteToMission, useQuote,
  type Quote as QuoteType,
} from "@/hooks/use-phase3";
import { useSyncQuotePennylane } from "@/hooks/use-payments";
import { useClients } from "@/hooks/use-clients";
// 2026-05-20 refonte devis — catalogue, missions, types de devis, TVA
import { useProducts, useVatRates } from "@/hooks/use-products";
import { useClientMissions, useMissionPrestations } from "@/hooks/use-missions";
// 2026-05-21 — produits de stock dans les devis (chiffrage seul, 0 mouvement)
import { useStockProductOptions } from "@/hooks/use-operations";
import {
  useQuoteTypes, useCreateQuoteType, useUpdateQuoteType, useDeleteQuoteType,
  type QuoteType as QuoteTypeModel,
} from "@/hooks/use-quote-types";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
  const [typesOpen, setTypesOpen] = useState(false); // 2026-05-20 refonte devis
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null); // 2026-05-21 — édition devis
  const navigate = useNavigate();

  const { data, isLoading } = useQuotes({
    page,
    per_page: 25,
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const del = useDeleteQuote();
  const convert = useConvertQuoteToInvoice();
  const updateQuote = useUpdateQuote();
  const convertMission = useConvertQuoteToMission();
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

  // 2026-05-20 PDF B2B — download du PDF devis via blob (préserve l'auth Sanctum,
  // contrairement à un <a href> direct). Pattern repris de ClientSalesTab.
  const handleDownloadPdf = async (id: number, ref: string) => {
    try {
      const res = await api.get(`/quotes/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ref ?? `QUO-${id}`}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Téléchargement PDF devis échoué", e?.response ?? e);
      toast.error("Échec du téléchargement du PDF");
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

  // 2026-05-21 — envoi du devis au client (brouillon → envoyé). Le client le
  // voit alors dans son extranet « en attente de validation » (QuoteObserver
  // émet la notification sur le changement de statut).
  const handleSend = async (id: number, ref: string) => {
    if (!confirm(`Envoyer le devis ${ref} au client ? Il pourra le valider depuis son extranet.`)) return;
    try {
      await updateQuote.mutateAsync({ id, patch: { status: "sent" } });
      toast.success("Devis envoyé au client (en attente de validation)");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Échec de l'envoi du devis"));
    }
  };

  // 2026-05-21 — conversion devis → mission. Réservé aux devis validés par le
  // client (statut « accepté »). Le backend gère l'anti-doublon.
  const handleConvertMission = async (q: any) => {
    if (!confirm(`Créer la mission depuis le devis ${q.reference ?? `#${q.id}`} ?`)) return;
    try {
      const { mission, alreadyExisted } = await convertMission.mutateAsync(q.id);
      toast.success(
        alreadyExisted
          ? "Une mission existait déjà pour ce devis — ouverture en édition."
          : "Mission créée depuis le devis — vous pouvez l'ajuster.",
      );
      navigate(`/clients/${mission.client_id}/missions/${mission.id}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Échec de la création de la mission"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Devis"
        description="Propositions commerciales — gestion complète avec items + conversion en facture"
        actions={
          <div className="flex gap-2">
            {/* 2026-05-20 refonte devis — accès gestion des types de devis */}
            <Button
              variant="outline"
              onClick={() => setTypesOpen(true)}
              className="cursor-pointer"
            >
              <Settings2 className="h-4 w-4 mr-2" /> Types de devis
            </Button>
            <Button
              onClick={() => setOpen(true)}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" /> Nouveau devis
            </Button>
          </div>
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
                <TableHead className="w-64 text-right">Actions</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">{fmtDateFr(q.quote_date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDateFr(q.validity_date)}</TableCell>
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
                      {/* 2026-05-21 — édition du devis (verrouillée si déjà converti en facture) */}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer"
                        title={q.invoice_id ? "Devis converti en facture — non modifiable" : "Modifier le devis"}
                        disabled={!!q.invoice_id}
                        onClick={() => setEditId(q.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* 2026-05-21 — envoi au client : uniquement sur un brouillon */}
                      {q.status === "draft" && (
                        <Button size="sm" variant="outline"
                          className="h-7 w-7 p-0 cursor-pointer text-indigo-600 hover:bg-indigo-500/10"
                          title="Envoyer au client"
                          disabled={updateQuote.isPending}
                          onClick={() => handleSend(q.id, q.reference ?? `#${q.id}`)}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* 2026-05-21 — transformer en mission : uniquement un devis validé */}
                      {q.status === "accepted" && (
                        <Button size="sm" variant="outline"
                          className="h-7 w-7 p-0 cursor-pointer text-emerald-600 hover:bg-emerald-500/10"
                          title="Transformer en mission"
                          disabled={convertMission.isPending}
                          onClick={() => handleConvertMission(q)}>
                          <Briefcase className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* 2026-05-20 PDF B2B */}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 cursor-pointer" title="Télécharger PDF"
                        onClick={() => handleDownloadPdf(q.id, q.reference ?? `#${q.id}`)}>
                        <FileDown className="h-3.5 w-3.5" />
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

      {/* 2026-05-20 refonte devis — key force le remount = reset propre du form à chaque ouverture */}
      {open && <CreateQuoteDialog key="create-quote" onClose={() => setOpen(false)} />}
      {/* 2026-05-21 — édition d'un devis existant (key par id = form re-seedé) */}
      {editId && <EditQuoteDialog key={`edit-${editId}`} id={editId} onClose={() => setEditId(null)} />}
      <QuoteDetailDialog id={detailId} onClose={() => setDetailId(null)} />
      {typesOpen && <QuoteTypesDialog onClose={() => setTypesOpen(false)} />}
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
  const convertToMission = useConvertQuoteToMission();
  const navigate = useNavigate();

  // Le devis est validé par le client → l'admin peut générer la mission.
  const canCreateMission = data?.status === "accepted";

  const handleCreateMission = async () => {
    if (!data) return;
    try {
      const { mission, alreadyExisted } = await convertToMission.mutateAsync(data.id);
      toast.success(
        alreadyExisted
          ? "Une mission existait déjà pour ce devis — ouverture en édition."
          : "Mission créée depuis le devis — vous pouvez l'ajuster.",
      );
      onClose();
      // Ouvre la mission en édition pour que l'admin révise/affine
      // (nature, récurrence, intervenant…).
      navigate(`/clients/${mission.client_id}/missions/${mission.id}`);
    } catch (err) {
      console.error("Conversion devis → mission échouée", err);
      toast.error(apiErrorMessage(err, "Échec de la création de la mission"));
    }
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* 2026-06-24 — max-h + overflow-y-auto : le dialog scrolle si le
          contenu (descriptif long) dépasse la hauteur de l'écran. */}
      <DialogContent className="sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détail du devis {data?.reference ?? ""}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" value={data.client?.company?.company_name ?? `Client #${data.client_id}`} />
              <Field label="Statut" value={STATUS_LABELS[data.status] ?? data.status} />
              <Field label="Date du devis" value={fmtDateFr(data.quote_date)} />
              <Field label="Validité" value={fmtDateFr(data.validity_date)} />
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

            {/* 2026-06-24 — whitespace-pre-wrap : préserve les retours à la
                ligne du descriptif dans l'aperçu (comme sur le PDF). */}
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
        )}
        <DialogFooter className="gap-2">
          {canCreateMission && (
            <Button
              onClick={handleCreateMission}
              disabled={convertToMission.isPending}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer mr-auto"
            >
              {convertToMission.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Briefcase className="h-4 w-4 mr-2" />
              )}
              Créer la mission
            </Button>
          )}
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

// ===========================================================================
// 2026-05-20 refonte devis — Création de devis pilotée par le catalogue
// ===========================================================================
//
// Flux : Client → Type de devis (optionnel) → Nature → Origine (mission si
// régulière) → Lignes (catalogue ou libres) → dates/commentaire.
// Les lignes proviennent du catalogue de prestations (sélecteur qui pré-remplit
// prix/TVA/type) ou sont saisies à la main (ligne libre).
//
// Conventions projet respectées :
//  - submit jamais `disabled` pour règle métier (validation au clic → toast)
//  - try/catch sur la mutation (toast.error + console.error en cas d'échec)
//  - entity_id NON envoyé (dérivé du client côté backend)
//  - le composant est monté avec une `key` par le parent → reset propre

// Une ligne du devis en cours d'édition.
// kind : 'catalog' = prestation du catalogue, 'free' = ligne libre,
//        'stock'   = produit du stock (chiffrage seul, AUCUN mouvement).
type LineKind = "catalog" | "free" | "stock";
type DraftItem = {
  uid: string;            // clé React stable (pas l'index)
  kind: LineKind;
  product_id: number | null;       // prestation catalogue (kind = catalog)
  stock_product_id: number | null; // produit du stock (kind = stock)
  label: string;
  quantity: string;
  duration_minutes: string;         // C4 2026-05-22 — durée standard saisie sur le devis
  unit_price: string;
  vat_rate_id: number | null;
  item_type: string;
};

let _uidSeq = 0;
const nextUid = () => `it-${++_uidSeq}`;

// Le catalogue Product.type ('hourly'|'forfait'|'frais'|'remise'|'carte'|'exceptional')
// ne mappe pas 1:1 sur item_type ('hourly'|'forfait'|'frais'|'remise'|'produit'|'carte'|'adjustment').
// 'exceptional' n'est pas un item_type valide → on retombe sur 'forfait'.
function productTypeToItemType(t: string | null | undefined): string {
  switch (t) {
    case "hourly":
    case "forfait":
    case "frais":
    case "remise":
    case "carte":
      return t;
    default:
      return "forfait";
  }
}

function CreateQuoteDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateQuote();
  const { data: clientsData } = useClients({ per_page: 100 });
  const { data: products } = useProducts({ status: "active", per_page: 100 });
  const { data: vatRates } = useVatRates();
  const { data: quoteTypes } = useQuoteTypes({ status: "active" });
  // 2026-05-21 — produits du stock (consommables/matériel). Chiffrage SEUL :
  // un devis ne déclenche aucun mouvement de stock.
  const { data: stockOptions } = useStockProductOptions();

  const [clientId, setClientId] = useState("");
  const [quoteTypeId, setQuoteTypeId] = useState("none");
  const [nature, setNature] = useState<"regular" | "punctual">("regular");
  const [missionId, setMissionId] = useState("none");
  const [quoteDate, setQuoteDate] = useState(() => {
    // Date locale (pas toISOString qui passe en UTC → off-by-one près de minuit)
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [validityDate, setValidityDate] = useState("");
  // 2026-06-24 — 2 champs notes séparés : `comment` = visible sur PDF
  // client, `internalNotes` = jamais sur le PDF, admin only.
  const [comment, setComment] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  // Missions du client sélectionné (uniquement pertinent en nature régulière)
  const numClientId = clientId ? parseInt(clientId, 10) : 0;
  const { data: missions } = useClientMissions(numClientId);
  // Prestations de la mission choisie (pour le bouton "Charger les prestations")
  const numMissionId = missionId !== "none" ? parseInt(missionId, 10) : null;
  const { data: missionPrestations } = useMissionPrestations(numMissionId);

  const total = items.reduce(
    (sum, it) => sum + parseFloat(it.quantity || "0") * parseFloat(it.unit_price || "0"),
    0,
  );

  // Charge une ligne par client_prestation de la mission sélectionnée.
  // unit_price = custom_price ?? base_price ?? product.price.
  const loadMissionPrestations = () => {
    if (!missionPrestations || missionPrestations.length === 0) {
      toast.error("Cette mission n'a aucune prestation contractualisée.");
      return;
    }
    const loaded: DraftItem[] = missionPrestations.map((pr) => {
      const price = pr.custom_price ?? pr.base_price ?? pr.product?.price ?? 0;
      // TVA reprise du product catalogue lié à la prestation
      const catalogProduct = pr.product_id
        ? products?.data.find((x) => x.id === pr.product_id)
        : undefined;
      return {
        uid: nextUid(),
        kind: "catalog" as LineKind,
        product_id: pr.product_id ?? null,
        stock_product_id: null,
        label: pr.label,
        quantity: "1",
        // C4 2026-05-22 — durée reprise de la prestation contractualisée.
        duration_minutes: pr.duration_minutes != null ? String(pr.duration_minutes) : "",
        unit_price: String(Number(price) || 0),
        vat_rate_id: catalogProduct?.vat_rate_id ?? null,
        item_type: productTypeToItemType(catalogProduct?.type ?? pr.billing_type),
      };
    });
    setItems((arr) => [...arr, ...loaded]);
    toast.success(`${loaded.length} prestation(s) chargée(s) depuis la mission.`);
  };

  // Sélection d'un type de devis → pré-remplit la nature depuis le type
  const handleQuoteTypeChange = (value: string) => {
    setQuoteTypeId(value);
    if (value !== "none") {
      const qt = quoteTypes?.find((t) => String(t.id) === value);
      if (qt?.nature) setNature(qt.nature);
    }
  };

  // Changement de client → reset mission (les missions appartiennent au client)
  const handleClientChange = (value: string) => {
    setClientId(value);
    setMissionId("none");
  };

  // 2026-05-21 — deux modes d'enregistrement :
  //  - 'draft' : brouillon, NON visible côté client
  //  - 'sent'  : envoyé → visible côté client « en attente de validation »,
  //              + notification au client (gérée par QuoteObserver)
  const handleSave = async (status: "draft" | "sent") => {
    // Validation métier au clic (jamais de submit disabled — cf. convention projet)
    const errors: string[] = [];
    if (!clientId) errors.push("Le client est requis.");
    if (!quoteDate) errors.push("La date du devis est requise.");
    const validItems = items.filter((it) => it.label.trim());
    if (validItems.length === 0) errors.push("Ajoutez au moins une ligne avec une désignation.");
    validItems.forEach((it, i) => {
      const q = parseFloat(it.quantity);
      const u = parseFloat(it.unit_price);
      if (isNaN(q) || q <= 0) errors.push(`Ligne ${i + 1} : quantité invalide.`);
      if (isNaN(u) || u < 0) errors.push(`Ligne ${i + 1} : prix unitaire invalide.`);
    });
    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }

    try {
      await create.mutateAsync({
        client_id: parseInt(clientId, 10),
        // entity_id volontairement absent → dérivé du client côté backend
        quote_type_id: quoteTypeId === "none" ? null : parseInt(quoteTypeId, 10),
        mission_id: nature === "regular" && missionId !== "none" ? parseInt(missionId, 10) : null,
        quote_date: quoteDate,
        validity_date: validityDate || null,
        nature,
        status,
        comment: comment.trim() || null,
        internal_notes: internalNotes.trim() || null,
        items: validItems.map((it) => ({
          label: it.label.trim(),
          quantity: parseFloat(it.quantity),
          // C4 2026-05-22 — durée standard saisie sur le devis (vide = null)
          duration_minutes: it.duration_minutes.trim() === "" ? null : parseInt(it.duration_minutes, 10),
          unit_price: parseFloat(it.unit_price),
          item_type: it.item_type,
          vat_rate_id: it.vat_rate_id,
          product_id: it.product_id,
          // 2026-05-21 — produit du stock chiffré (chiffrage seul, 0 mouvement)
          stock_product_id: it.stock_product_id,
        })),
      } as any);
      toast.success(status === "sent"
        ? "Devis envoyé au client (en attente de validation)"
        : "Devis enregistré en brouillon");
      onClose();
    } catch (err) {
      // toast.error explicite + console.error avec payload pour debug (cf. convention projet)
      toast.error(apiErrorMessage(err, "Échec de l'enregistrement du devis"));
      console.error("Enregistrement devis échoué", err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nouveau devis</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleSave("draft"); }} className="space-y-4">
          {/* --- Client + Type --- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client *</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="— Choisir un client —" /></SelectTrigger>
                <SelectContent>
                  {clientsData?.data?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.company?.company_name ?? c.display_name ?? c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type de devis</Label>
              <Select value={quoteTypeId} onValueChange={handleQuoteTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {quoteTypes?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* --- Nature --- */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nature</Label>
            <Select value={nature} onValueChange={(v) => { setNature(v as "regular" | "punctual"); if (v !== "regular") setMissionId("none"); }}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Régulière (depuis une mission)</SelectItem>
                <SelectItem value="punctual">Ponctuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* --- Origine : mission (uniquement si régulière) --- */}
          {nature === "regular" && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Mission d'origine
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={missionId}
                  onValueChange={setMissionId}
                  disabled={!clientId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={clientId ? "— Aucune mission —" : "Choisir un client d'abord"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune mission —</SelectItem>
                    {missions?.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadMissionPrestations}
                  disabled={missionId === "none"}
                  className="cursor-pointer shrink-0"
                >
                  <PackagePlus className="h-3.5 w-3.5 mr-1.5" /> Charger les prestations
                </Button>
              </div>
              {missions && missions.length === 0 && clientId && (
                <p className="text-xs text-muted-foreground">Ce client n'a aucune mission.</p>
              )}
            </div>
          )}

          {/* --- Lignes --- (éditeur partagé avec EditQuoteDialog) */}
          <QuoteLinesSection
            items={items}
            setItems={setItems}
            products={products}
            vatRates={vatRates}
            stockOptions={stockOptions}
          />

          {/* --- Dates + commentaire --- */}
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date du devis *</Label>
              <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date de validité</Label>
              <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Description <span className="text-[10px] text-emerald-600">— visible sur le PDF envoyé au client</span>
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Ex : prestation prévue sur 3 semaines, intervention 2 fois/semaine…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Note interne <span className="text-[10px] text-amber-600">— JAMAIS visible côté client, admins uniquement</span>
            </Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              placeholder="Ex : à relancer dans 3 jours, négociation prix à confirmer…"
            />
          </div>

          <div className="text-right text-lg font-semibold border-t pt-3">
            Total HT : {total.toFixed(2)} €
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending} className="cursor-pointer">
              Annuler
            </Button>
            <Button type="button" variant="outline" disabled={create.isPending}
              onClick={() => handleSave("draft")} className="cursor-pointer">
              {create.isPending ? "Enregistrement…" : "Enregistrer en brouillon"}
            </Button>
            <Button type="button" disabled={create.isPending}
              onClick={() => handleSave("sent")}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer">
              {create.isPending ? "Envoi…" : "Enregistrer et envoyer au client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// 2026-05-21 — Éditeur de lignes de devis, partagé entre création et édition
// ===========================================================================
//
// Gère les 3 types de lignes (catalogue / stock / libre) + le calcul du
// sous-total par ligne. Le parent fournit `items` / `setItems` et les
// référentiels (catalogue de prestations, taux de TVA, produits du stock).

function QuoteLinesSection({
  items, setItems, products, vatRates, stockOptions,
}: {
  items: DraftItem[];
  setItems: Dispatch<SetStateAction<DraftItem[]>>;
  products?: { data: any[] };
  vatRates?: any[];
  stockOptions?: any[];
}) {
  const blankLine = (kind: LineKind): DraftItem => ({
    uid: nextUid(), kind, product_id: null, stock_product_id: null,
    label: "", quantity: "1", duration_minutes: "", unit_price: "0", vat_rate_id: null,
    item_type: kind === "stock" ? "produit" : "forfait",
  });

  const addCatalogLine = () => setItems((arr) => [...arr, blankLine("catalog")]);
  const addFreeLine = () => setItems((arr) => [...arr, blankLine("free")]);
  const addStockLine = () => setItems((arr) => [...arr, blankLine("stock")]);
  const removeLine = (uid: string) => setItems((arr) => arr.filter((it) => it.uid !== uid));
  const updateLine = (uid: string, patch: Partial<DraftItem>) =>
    setItems((arr) => arr.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));

  // Choix d'une prestation catalogue → pré-remplit label/prix/TVA/type/product_id
  const pickProduct = (uid: string, productIdStr: string) => {
    const pid = parseInt(productIdStr, 10);
    const p = products?.data.find((x) => x.id === pid);
    if (!p) return;
    updateLine(uid, {
      product_id: p.id,
      label: p.name,
      unit_price: String(p.price ?? 0),
      vat_rate_id: p.vat_rate_id ?? null,
      item_type: productTypeToItemType(p.type),
    });
  };

  // Choix d'un produit du stock → pré-remplit le label depuis le produit.
  const pickStockProduct = (uid: string, stockIdStr: string) => {
    const sid = parseInt(stockIdStr, 10);
    const sp = stockOptions?.find((x) => x.id === sid);
    if (!sp) return;
    updateLine(uid, {
      stock_product_id: sp.id,
      label: sp.reference ? `${sp.name} (${sp.reference})` : sp.name,
      item_type: "produit",
    });
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Lignes du devis</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addCatalogLine} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-1" /> Prestation du catalogue
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addStockLine} className="cursor-pointer">
            <Boxes className="h-3.5 w-3.5 mr-1" /> Produit du stock
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addFreeLine} className="cursor-pointer">
            <PencilLine className="h-3.5 w-3.5 mr-1" /> Ligne libre
          </Button>
        </div>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground py-3 text-center border rounded-lg border-dashed">
          Aucune ligne. Ajoutez une prestation du catalogue, un produit du
          stock, ou une ligne libre.
        </p>
      )}

      {items.map((it) => (
        <div key={it.uid} className="rounded-lg border p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            {it.kind === "free" && (
              <Badge variant="secondary" className="text-[10px] shrink-0">Libre</Badge>
            )}
            {it.kind === "catalog" && (
              <Badge variant="outline" className="text-[10px] shrink-0">Catalogue</Badge>
            )}
            {it.kind === "stock" && (
              <Badge className="text-[10px] shrink-0 bg-amber-500/15 text-amber-700 border-amber-500/30">
                Stock
              </Badge>
            )}
            {it.kind === "free" && (
              <Input
                placeholder="Désignation (ex : frais de déplacement, remise…)"
                value={it.label}
                onChange={(e) => updateLine(it.uid, { label: e.target.value })}
                className="flex-1"
              />
            )}
            {it.kind === "catalog" && (
              <Select
                value={it.product_id ? String(it.product_id) : ""}
                onValueChange={(v) => pickProduct(it.uid, v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="— Choisir une prestation —" />
                </SelectTrigger>
                <SelectContent>
                  {products?.data.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {Number(p.price).toFixed(2)} €
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {it.kind === "stock" && (
              <Select
                value={it.stock_product_id ? String(it.stock_product_id) : ""}
                onValueChange={(v) => pickStockProduct(it.uid, v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="— Choisir un produit du stock —" />
                </SelectTrigger>
                <SelectContent>
                  {(stockOptions ?? []).length === 0 && (
                    <SelectItem value="__none" disabled>
                      Aucun produit en stock actif
                    </SelectItem>
                  )}
                  {stockOptions?.map((sp) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.name}
                      {sp.reference ? ` · ${sp.reference}` : ""}
                      <span className="text-muted-foreground ml-1">
                        (stock : {sp.current_quantity})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              type="button"
              onClick={() => removeLine(it.uid)}
              className="text-destructive hover:bg-destructive/10 p-1.5 rounded shrink-0 cursor-pointer"
              title="Supprimer la ligne"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* 2026-06-24 — Ajout sélecteur "Mode" (BILLING_TYPES). Le champ
              "Durée (min)" n'apparaît QUE si le mode = horaire (sinon
              c'est un forfait/frais/remise → aucun sens d'entrer des
              minutes). Le champ n'est plus obligatoire mentalement. */}
          <div className="grid grid-cols-[1fr_70px_110px_70px_100px_80px] gap-2 items-center">
            {/* Le label catalogue/stock reste éditable une fois l'item choisi */}
            {it.kind !== "free" && (
              <Input
                placeholder="Désignation"
                value={it.label}
                onChange={(e) => updateLine(it.uid, { label: e.target.value })}
              />
            )}
            {it.kind === "free" && (
              <span className="text-[10px] text-muted-foreground self-center">
                Qté · Mode · Dur · PU · TVA
              </span>
            )}
            <Input
              type="number" step="0.01" min="0" placeholder="Qté"
              value={it.quantity}
              onChange={(e) => updateLine(it.uid, { quantity: e.target.value })}
            />
            <Select
              value={it.item_type ?? "forfait"}
              onValueChange={(v) => updateLine(it.uid, { item_type: v })}
              disabled={it.kind === "stock"}
            >
              <SelectTrigger title="Mode de facturation"><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="forfait">Forfait</SelectItem>
                <SelectItem value="hourly">Horaire</SelectItem>
                <SelectItem value="frais">Frais</SelectItem>
                <SelectItem value="remise">Remise</SelectItem>
                <SelectItem value="carte">Carte</SelectItem>
                <SelectItem value="produit">Produit</SelectItem>
                <SelectItem value="adjustment">Ajustement</SelectItem>
              </SelectContent>
            </Select>
            {/* Durée affichée UNIQUEMENT pour le mode horaire (sinon zéro
                sens d'entrer des minutes sur un forfait global / frais). */}
            {it.item_type === "hourly" ? (
              <Input
                type="number" step="1" min="0" placeholder="Min"
                title="Durée en minutes (uniquement pour facturation horaire)"
                value={it.duration_minutes}
                onChange={(e) => updateLine(it.uid, { duration_minutes: e.target.value })}
              />
            ) : (
              <span className="text-[10px] text-muted-foreground text-center self-center">
                —
              </span>
            )}
            <Input
              type="number" step="0.01" min="0" placeholder="PU €"
              value={it.unit_price}
              onChange={(e) => updateLine(it.uid, { unit_price: e.target.value })}
            />
            <Select
              value={it.vat_rate_id ? String(it.vat_rate_id) : "none"}
              onValueChange={(v) => updateLine(it.uid, { vat_rate_id: v === "none" ? null : parseInt(v, 10) })}
            >
              <SelectTrigger><SelectValue placeholder="TVA" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— TVA —</SelectItem>
                {vatRates?.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.rate}%</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {it.kind === "stock" && (
            <p className="text-[10px] text-amber-700">
              Produit du stock — chiffrage seul : le devis ne décompte
              aucun stock. Le décompte aura lieu en l'ajoutant à la mission.
            </p>
          )}
          <p className="text-right text-xs text-muted-foreground">
            Sous-total ligne : {(parseFloat(it.quantity || "0") * parseFloat(it.unit_price || "0")).toFixed(2)} €
          </p>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// 2026-05-21 — Édition d'un devis existant
// ===========================================================================
//
// PATCH /quotes/{id} accepte : quote_date, validity_date, status, comment et
// items[] (remplacement complet des lignes). Le client, le type et la mission
// d'origine ne sont PAS modifiables ici (ils définissent l'identité du devis).
// Un devis déjà converti en facture est verrouillé côté backend (409) — le
// bouton d'édition est d'ailleurs désactivé dans ce cas.

// Convertit les `quote_items` renvoyés par l'API en lignes éditables.
function quoteItemsToDraft(items: any[]): DraftItem[] {
  return items.map((it) => {
    const kind: LineKind = it.stock_product_id
      ? "stock"
      : it.product_id
        ? "catalog"
        : "free";
    return {
      uid: nextUid(),
      kind,
      product_id: it.product_id ?? null,
      stock_product_id: it.stock_product_id ?? null,
      label: it.label ?? "",
      quantity: String(it.quantity ?? "1"),
      // C4 2026-05-22 — durée standard relue à l'édition d'un devis existant.
      duration_minutes: it.duration_minutes != null ? String(it.duration_minutes) : "",
      unit_price: String(it.unit_price ?? "0"),
      vat_rate_id: it.vat_rate_id ?? null,
      item_type: it.item_type ?? "forfait",
    };
  });
}

function EditQuoteDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuote(id);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le devis {data?.reference ?? ""}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-64 w-full" />}
        {/* EditQuoteForm n'est monté qu'avec les données → seed direct du state */}
        {data && <EditQuoteForm quote={data} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditQuoteForm({ quote, onClose }: { quote: QuoteType; onClose: () => void }) {
  const update = useUpdateQuote();
  const { data: products } = useProducts({ status: "active", per_page: 100 });
  const { data: vatRates } = useVatRates();
  const { data: stockOptions } = useStockProductOptions();

  // slice(0,10) : une date ISO complète casse <input type="date"> (veut YYYY-MM-DD)
  const [quoteDate, setQuoteDate] = useState((quote.quote_date ?? "").slice(0, 10));
  const [validityDate, setValidityDate] = useState((quote.validity_date ?? "").slice(0, 10));
  const [status, setStatus] = useState<QuoteType["status"]>(quote.status);
  const [comment, setComment] = useState(quote.comment ?? "");
  // 2026-06-24 — notes admin séparées (jamais sur le PDF client).
  const [internalNotes, setInternalNotes] = useState((quote as any).internal_notes ?? "");
  const [items, setItems] = useState<DraftItem[]>(() => quoteItemsToDraft(quote.items ?? []));

  const total = items.reduce(
    (sum, it) => sum + parseFloat(it.quantity || "0") * parseFloat(it.unit_price || "0"),
    0,
  );

  const handleSave = async () => {
    // Validation métier au clic (cf. convention projet — pas de submit disabled)
    const errors: string[] = [];
    if (!quoteDate) errors.push("La date du devis est requise.");
    const validItems = items.filter((it) => it.label.trim());
    if (validItems.length === 0) errors.push("Le devis doit comporter au moins une ligne.");
    validItems.forEach((it, i) => {
      const q = parseFloat(it.quantity);
      const u = parseFloat(it.unit_price);
      if (isNaN(q) || q <= 0) errors.push(`Ligne ${i + 1} : quantité invalide.`);
      if (isNaN(u) || u < 0) errors.push(`Ligne ${i + 1} : prix unitaire invalide.`);
    });
    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }

    try {
      await update.mutateAsync({
        id: quote.id,
        patch: {
          quote_date: quoteDate,
          validity_date: validityDate || null,
          status,
          comment: comment.trim() || null,
          internal_notes: internalNotes.trim() || null,
          items: validItems.map((it) => ({
            label: it.label.trim(),
            quantity: parseFloat(it.quantity),
            // C4 2026-05-22 — durée standard saisie sur le devis (vide = null)
            duration_minutes: it.duration_minutes.trim() === "" ? null : parseInt(it.duration_minutes, 10),
            unit_price: parseFloat(it.unit_price),
            item_type: it.item_type,
            vat_rate_id: it.vat_rate_id,
            product_id: it.product_id,
            stock_product_id: it.stock_product_id,
          })),
        },
      });
      toast.success("Devis mis à jour");
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de la mise à jour du devis"));
      console.error("Mise à jour devis échouée", err);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
      {/* Client : non modifiable ici (rappel en lecture seule) */}
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">Client : </span>
        <span className="font-medium">
          {quote.client?.company?.company_name ?? `Client #${quote.client_id}`}
        </span>
      </div>

      {/* Statut */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Statut</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as QuoteType["status"])}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          « Envoyé » rend le devis visible côté client. « Accepté » autorise la
          transformation en mission.
        </p>
      </div>

      {/* Lignes (éditeur partagé avec la création) */}
      <QuoteLinesSection
        items={items}
        setItems={setItems}
        products={products}
        vatRates={vatRates}
        stockOptions={stockOptions}
      />

      {/* Dates + commentaire */}
      <div className="grid grid-cols-2 gap-3 border-t pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date du devis *</Label>
          <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date de validité</Label>
          <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Description <span className="text-[10px] text-emerald-600">— visible sur le PDF envoyé au client</span>
        </Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Ex : prestation prévue sur 3 semaines, intervention 2 fois/semaine…"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Note interne <span className="text-[10px] text-amber-600">— JAMAIS visible côté client, admins uniquement</span>
        </Label>
        <Textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2}
          placeholder="Ex : à relancer dans 3 jours, négociation prix à confirmer…"
        />
      </div>

      <div className="text-right text-lg font-semibold border-t pt-3">
        Total HT : {total.toFixed(2)} €
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending} className="cursor-pointer">
          Annuler
        </Button>
        <Button type="button" disabled={update.isPending}
          onClick={handleSave}
          className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-90 cursor-pointer">
          {update.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ===========================================================================
// 2026-05-20 refonte devis — Gestion des types de devis (CRUD inline)
// ===========================================================================

const QT_NATURE_LABELS: Record<string, string> = {
  regular: "Régulière",
  punctual: "Ponctuelle",
};

const QT_CALC_LABELS: Record<string, string> = {
  per_week: "Par semaine",
  per_month: "Par mois",
  per_unit: "À l'unité",
};

// Forme d'édition d'un type de devis (tous les champs en string pour les inputs)
type QuoteTypeDraft = {
  label: string;
  nature: string;          // "regular" | "punctual" | "none"
  modality: string;
  billing_mode: string;
  quote_calculation: string; // "per_week" | "per_month" | "per_unit" | "none"
  commitment_duration: string;
  billing_rhythm: string;
  deposit_percent: string;
  status: "active" | "inactive";
};

function emptyQuoteTypeDraft(): QuoteTypeDraft {
  return {
    label: "", nature: "none", modality: "", billing_mode: "",
    quote_calculation: "none", commitment_duration: "", billing_rhythm: "",
    deposit_percent: "", status: "active",
  };
}

function draftFromQuoteType(qt: QuoteTypeModel): QuoteTypeDraft {
  return {
    label: qt.label ?? "",
    nature: qt.nature ?? "none",
    modality: qt.modality ?? "",
    billing_mode: qt.billing_mode ?? "",
    quote_calculation: qt.quote_calculation ?? "none",
    commitment_duration: qt.commitment_duration ?? "",
    billing_rhythm: qt.billing_rhythm ?? "",
    deposit_percent: qt.deposit_percent != null ? String(qt.deposit_percent) : "",
    status: qt.status,
  };
}

function QuoteTypesDialog({ onClose }: { onClose: () => void }) {
  // On liste TOUS les types (actifs + inactifs) pour permettre la réactivation.
  const { data: types, isLoading } = useQuoteTypes();
  const createMut = useCreateQuoteType();
  const updateMut = useUpdateQuoteType();
  const deleteMut = useDeleteQuoteType();

  // editing : null = pas de form, "new" = création, number = édition de cet id
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<QuoteTypeDraft>(emptyQuoteTypeDraft());

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const startCreate = () => { setDraft(emptyQuoteTypeDraft()); setEditing("new"); };
  const startEdit = (qt: QuoteTypeModel) => { setDraft(draftFromQuoteType(qt)); setEditing(qt.id); };
  const cancelEdit = () => { setEditing(null); setDraft(emptyQuoteTypeDraft()); };

  const buildPayload = (): Partial<QuoteTypeModel> => ({
    label: draft.label.trim(),
    nature: draft.nature === "none" ? null : (draft.nature as "regular" | "punctual"),
    modality: draft.modality.trim() || null,
    billing_mode: draft.billing_mode.trim() || null,
    quote_calculation: draft.quote_calculation === "none"
      ? null
      : (draft.quote_calculation as "per_week" | "per_month" | "per_unit"),
    commitment_duration: draft.commitment_duration.trim() || null,
    billing_rhythm: draft.billing_rhythm.trim() || null,
    deposit_percent: draft.deposit_percent.trim() === "" ? null : Number(draft.deposit_percent),
    status: draft.status,
  });

  const handleSave = async () => {
    if (!draft.label.trim()) {
      toast.error("Le libellé du type de devis est requis.");
      return;
    }
    if (draft.deposit_percent.trim() !== "") {
      const dp = Number(draft.deposit_percent);
      if (isNaN(dp) || dp < 0 || dp > 100) {
        toast.error("L'acompte doit être un pourcentage entre 0 et 100.");
        return;
      }
    }
    try {
      if (editing === "new") {
        await createMut.mutateAsync(buildPayload());
        toast.success("Type de devis créé.");
      } else if (typeof editing === "number") {
        await updateMut.mutateAsync({ id: editing, patch: buildPayload() });
        toast.success("Type de devis mis à jour.");
      }
      cancelEdit();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de l'enregistrement."));
      console.error("Enregistrement type de devis échoué", err);
    }
  };

  const handleDeactivate = async (qt: QuoteTypeModel) => {
    if (!confirm(`Désactiver le type « ${qt.label} » ? Il ne sera plus proposé dans les nouveaux devis.`)) return;
    try {
      await deleteMut.mutateAsync(qt.id);
      toast.success("Type de devis désactivé.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de la désactivation."));
      console.error("Désactivation type de devis échouée", err);
    }
  };

  const handleReactivate = async (qt: QuoteTypeModel) => {
    try {
      await updateMut.mutateAsync({ id: qt.id, patch: { status: "active" } });
      toast.success("Type de devis réactivé.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Échec de la réactivation."));
      console.error("Réactivation type de devis échouée", err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Types de devis</DialogTitle>
        </DialogHeader>

        {/* Formulaire création / édition inline */}
        {editing !== null ? (
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-sm font-medium">
              {editing === "new" ? "Nouveau type de devis" : "Modifier le type de devis"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">Libellé *</Label>
                <Input
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="ex : Devis ménage régulier"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nature</Label>
                <Select value={draft.nature} onValueChange={(v) => setDraft((d) => ({ ...d, nature: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Indéfinie —</SelectItem>
                    <SelectItem value="regular">Régulière</SelectItem>
                    <SelectItem value="punctual">Ponctuelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Statut</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modalité</Label>
                <Input
                  value={draft.modality}
                  onChange={(e) => setDraft((d) => ({ ...d, modality: e.target.value }))}
                  placeholder="ex : prélèvement"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mode de facturation</Label>
                <Input
                  value={draft.billing_mode}
                  onChange={(e) => setDraft((d) => ({ ...d, billing_mode: e.target.value }))}
                  placeholder="ex : forfaitaire"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Calcul du devis</Label>
                <Select value={draft.quote_calculation} onValueChange={(v) => setDraft((d) => ({ ...d, quote_calculation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Non défini —</SelectItem>
                    <SelectItem value="per_week">Par semaine</SelectItem>
                    <SelectItem value="per_month">Par mois</SelectItem>
                    <SelectItem value="per_unit">À l'unité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rythme de facturation</Label>
                <Input
                  value={draft.billing_rhythm}
                  onChange={(e) => setDraft((d) => ({ ...d, billing_rhythm: e.target.value }))}
                  placeholder="ex : mensuel"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Durée d'engagement</Label>
                <Input
                  value={draft.commitment_duration}
                  onChange={(e) => setDraft((d) => ({ ...d, commitment_duration: e.target.value }))}
                  placeholder="ex : 12 mois"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Acompte (%)</Label>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={draft.deposit_percent}
                  onChange={(e) => setDraft((d) => ({ ...d, deposit_percent: e.target.value }))}
                  placeholder="ex : 30"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={busy} className="cursor-pointer">
                Annuler
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={busy} className="cursor-pointer">
                {editing === "new" ? "Créer" : "Enregistrer"}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={startCreate} className="cursor-pointer self-start">
            <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau type
          </Button>
        )}

        {/* Liste des types existants */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Nature</TableHead>
                <TableHead>Calcul</TableHead>
                <TableHead>Acompte</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell>
                </TableRow>
              )}
              {!isLoading && (types?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Aucun type de devis. Crée le premier avec « Nouveau type ».
                  </TableCell>
                </TableRow>
              )}
              {types?.map((qt) => (
                <TableRow key={qt.id}>
                  <TableCell className="font-medium">{qt.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {qt.nature ? QT_NATURE_LABELS[qt.nature] : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {qt.quote_calculation ? QT_CALC_LABELS[qt.quote_calculation] : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {qt.deposit_percent != null && qt.deposit_percent !== "" ? `${qt.deposit_percent} %` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={qt.status === "active" ? "default" : "secondary"}>
                      {qt.status === "active" ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-7 w-7 p-0 cursor-pointer" title="Modifier"
                        onClick={() => startEdit(qt)} disabled={busy}
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </Button>
                      {qt.status === "active" ? (
                        <Button
                          type="button" size="sm" variant="outline"
                          className="h-7 w-7 p-0 cursor-pointer text-destructive hover:bg-destructive/10"
                          title="Désactiver"
                          onClick={() => handleDeactivate(qt)} disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          type="button" size="sm" variant="outline"
                          className="h-7 px-2 cursor-pointer text-xs"
                          title="Réactiver"
                          onClick={() => handleReactivate(qt)} disabled={busy}
                        >
                          Réactiver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
