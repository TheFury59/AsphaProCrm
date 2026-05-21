import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Receipt, Briefcase, Download, Ticket as TicketIcon, Plus,
  AlertCircle, MessageSquare, PackageOpen, Send,
  FileText, CheckCircle2, XCircle, Eye, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EntityAvatar } from "@/components/EntityAvatar";
import {
  useClientInvoices, useClientPrestations, useClientProfile,
  useClientQuotes, useClientTickets, useCreateClientTicket,
  useAcceptClientQuote, useRefuseClientQuote,
} from "@/hooks/use-extranet";
import { api, apiErrorMessage } from "@/lib/api";

/**
 * Bibliotheque de sections reutilisables pour l'extranet client.
 *
 * Chaque section est exportee individuellement et utilisee par les pages
 * dediees (ClientHome, ClientInvoicesPage, ClientPrestationsPage,
 * ClientTicketsPage). Ca evite la duplication et garantit la coherence
 * visuelle entre l'accueil overview et les pages "zoom".
 *
 * Le bouton "Nouvelle demande" + le Dialog sont aussi factorises ici.
 */

// =========================================================================
// Header avec greeting + logo entreprise + bouton "Nouvelle demande"
// =========================================================================

export function ClientGreetingHeader({ subtitle }: { subtitle?: string }) {
  const { data: profile } = useClientProfile();
  const [ticketOpen, setTicketOpen] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <EntityAvatar
        src={profile?.company?.logo_url}
        name={profile?.company?.company_name ?? profile?.code}
        variant="client"
        size="lg"
      />
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-semibold">
          Bonjour {profile?.company?.company_name ?? profile?.code ?? ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {subtitle ?? "Retrouvez vos documents, prestations et demandes en cours."}
        </p>
      </div>
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogTrigger asChild>
          <Button className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95">
            <Plus className="h-4 w-4 mr-1.5" /> Nouvelle demande
          </Button>
        </DialogTrigger>
        <NewTicketDialog onClose={() => setTicketOpen(false)} />
      </Dialog>
    </div>
  );
}

// =========================================================================
// Section : Mes factures
// =========================================================================

export function ClientInvoicesSection() {
  const { data: invoices = [] } = useClientInvoices();

  const downloadFacturX = async (invoiceId: number) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/facturx`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Téléchargement impossible");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Mes factures ({invoices.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.reference ?? `INV-${i.id}`}</TableCell>
                <TableCell className="text-xs">
                  {i.invoice_date && format(new Date(i.invoice_date), "dd/MM/yyyy", { locale: fr })}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {Number(i.total).toFixed(2)} €
                </TableCell>
                <TableCell>
                  <Badge variant={i.payment_status === "paid" ? "default" : i.payment_status === "partial" ? "secondary" : "outline"}>
                    {i.payment_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => downloadFacturX(i.id)}>
                    <Download className="h-3 w-3 mr-1" /> PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Aucune facture pour le moment.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Section : Mes devis (consultation + validation)
// =========================================================================

const QUOTE_STATUS_LABEL = (s: string): string => ({
  draft: "Brouillon",
  sent: "À valider",
  accepted: "Validé",
  refused: "Refusé",
  expired: "Expiré",
} as Record<string, string>)[s] ?? s;

const QUOTE_STATUS_VARIANT = (
  s: string,
): "default" | "secondary" | "destructive" | "outline" => ({
  draft: "secondary",
  sent: "outline",
  accepted: "default",
  refused: "destructive",
  expired: "secondary",
} as Record<string, "default" | "secondary" | "destructive" | "outline">)[s] ?? "secondary";

/** Télécharge le PDF d'un devis via l'endpoint extranet (blob → conserve l'auth Sanctum). */
async function downloadClientQuotePdf(quoteId: number, reference: string | null) {
  try {
    const res = await api.get(`/extranet/client/quotes/${quoteId}/pdf`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reference ?? `devis-${quoteId}`}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Téléchargement PDF devis échoué", err);
    toast.error("Téléchargement du PDF impossible");
  }
}

export function ClientQuotesSection() {
  const { data: quotes = [] } = useClientQuotes();
  const [reviewId, setReviewId] = useState<number | null>(null);

  const reviewQuote = quotes.find((q: any) => q.id === reviewId) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Mes devis ({quotes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((q: any) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-xs">{q.reference ?? `QUO-${q.id}`}</TableCell>
                <TableCell className="text-xs">
                  {q.quote_date && format(new Date(q.quote_date), "dd/MM/yyyy", { locale: fr })}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {Number(q.total ?? 0).toFixed(2)} €
                </TableCell>
                <TableCell>
                  <Badge variant={QUOTE_STATUS_VARIANT(q.status)}>
                    {QUOTE_STATUS_LABEL(q.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadClientQuotePdf(q.id, q.reference ?? null)}
                    >
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </Button>
                    {q.status === "sent" ? (
                      <Button
                        size="sm"
                        className="bg-gradient-aspha text-white border-0 hover:opacity-95"
                        onClick={() => setReviewId(q.id)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> Consulter et valider
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setReviewId(q.id)}>
                        <Eye className="h-3 w-3 mr-1" /> Détail
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {quotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Aucun devis pour le moment.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {reviewQuote && (
        <QuoteReviewDialog quote={reviewQuote} onClose={() => setReviewId(null)} />
      )}
    </Card>
  );
}

// =========================================================================
// Dialog : consulter un devis + valider / refuser
// =========================================================================

function QuoteReviewDialog({
  quote,
  onClose,
}: {
  quote: any;
  onClose: () => void;
}) {
  const accept = useAcceptClientQuote();
  const refuse = useRefuseClientQuote();
  const [confirmRefuse, setConfirmRefuse] = useState(false);
  const busy = accept.isPending || refuse.isPending;
  const pending = quote.status === "sent";
  const items: any[] = quote.items ?? [];

  const handleAccept = async () => {
    try {
      await accept.mutateAsync(quote.id);
      toast.success("Devis validé — merci ! Notre équipe prépare la suite.");
      onClose();
    } catch (err) {
      console.error("Validation devis échouée", err);
      toast.error(apiErrorMessage(err, "Validation impossible"));
    }
  };

  const handleRefuse = async () => {
    try {
      await refuse.mutateAsync(quote.id);
      toast.success("Devis refusé. Notre équipe en est informée.");
      onClose();
    } catch (err) {
      console.error("Refus devis échoué", err);
      toast.error(apiErrorMessage(err, "Refus impossible"));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Devis {quote.reference ?? `#${quote.id}`}
          </DialogTitle>
          <DialogDescription>
            {pending
              ? "Vérifiez le détail puis validez ou refusez ce devis."
              : `Statut : ${QUOTE_STATUS_LABEL(quote.status)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
              <p className="font-medium">
                {quote.quote_date
                  ? format(new Date(quote.quote_date), "dd/MM/yyyy", { locale: fr })
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Validité</p>
              <p className="font-medium">
                {quote.validity_date
                  ? format(new Date(quote.validity_date), "dd/MM/yyyy", { locale: fr })
                  : "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Détail des prestations
            </p>
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
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        Aucune ligne sur ce devis.
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.label}</TableCell>
                      <TableCell className="text-right">{Number(it.quantity ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(it.unit_price ?? 0).toFixed(2)} €</TableCell>
                      <TableCell className="text-right font-medium">{Number(it.total ?? 0).toFixed(2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-right text-base font-semibold mt-2">
              Total : {Number(quote.total ?? 0).toFixed(2)} €
            </div>
          </div>

          {quote.comment && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Commentaire
              </p>
              <p className="text-sm">{quote.comment}</p>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => downloadClientQuotePdf(quote.id, quote.reference ?? null)}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Télécharger le PDF du devis
          </Button>
        </div>

        <DialogFooter className="gap-2">
          {pending ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                disabled={busy}
                onClick={() => setConfirmRefuse(true)}
              >
                {refuse.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Refuser
              </Button>
              <Button
                type="button"
                className="bg-gradient-aspha text-white border-0 hover:opacity-95"
                disabled={busy}
                onClick={handleAccept}
              >
                {accept.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Valider le devis
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Confirmation du refus (action irréversible côté workflow) */}
      <Dialog open={confirmRefuse} onOpenChange={(o) => { if (!o) setConfirmRefuse(false); }}>
        <DialogContent className="sm:!max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-600" />
              Refuser le devis
            </DialogTitle>
            <DialogDescription>
              Le devis {quote.reference ?? `#${quote.id}`} sera marqué comme refusé
              et notre équipe en sera informée. Vous pourrez nous recontacter pour
              une nouvelle proposition.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmRefuse(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={refuse.isPending}
              onClick={() => { setConfirmRefuse(false); handleRefuse(); }}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// =========================================================================
// Section : Mes prestations
// =========================================================================

export function ClientPrestationsSection() {
  const { data: prestations = [] } = useClientPrestations();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> Mes prestations ({prestations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prestation</TableHead>
              <TableHead>Tarif</TableHead>
              <TableHead>Démarrée le</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prestations.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.label ?? p.product?.name}</TableCell>
                <TableCell className="text-sm">
                  {Number(p.custom_price ?? p.base_price ?? 0).toFixed(2)} €
                </TableCell>
                <TableCell className="text-xs">
                  {p.start_date && format(new Date(p.start_date), "dd/MM/yyyy", { locale: fr })}
                </TableCell>
                <TableCell>
                  {p.end_date ? <Badge variant="secondary">Terminée</Badge> : <Badge>Active</Badge>}
                </TableCell>
              </TableRow>
            ))}
            {prestations.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Aucune prestation pour le moment.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Section : Mes tickets / demandes
// =========================================================================

export function ClientTicketsSection() {
  const { data: tickets = [] } = useClientTickets();
  const [ticketOpen, setTicketOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <TicketIcon className="h-4 w-4" /> Mes demandes ({tickets.length})
        </CardTitle>
        <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle demande
            </Button>
          </DialogTrigger>
          <NewTicketDialog onClose={() => setTicketOpen(false)} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Aucune demande pour le moment.
                </TableCell>
              </TableRow>
            )}
            {tickets.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>{TICKET_TYPE_LABEL(t.type)}</TableCell>
                <TableCell className="text-sm font-medium">{t.subject ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={t.priority === "urgent" ? "destructive" : "outline"} className="text-[10px]">
                    {t.priority ?? "normale"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={t.status === "resolved" || t.status === "closed" ? "secondary" : "default"}>
                    {TICKET_STATUS_LABEL(t.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(t.created_at), { locale: fr, addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Helpers labels (utilises aussi par ClientHome pour les compteurs)
// =========================================================================

export const TICKET_TYPE_LABEL = (t: string): string => ({
  complaint: "Réclamation",
  problem_report: "Signalement",
  consumable_reorder: "Commande conso.",
} as Record<string, string>)[t] ?? t;

export const TICKET_STATUS_LABEL = (s: string): string => ({
  open: "Ouverte",
  in_progress: "En cours",
  resolved: "Résolue",
  closed: "Fermée",
} as Record<string, string>)[s] ?? s;

// =========================================================================
// Stat card pour l'accueil
// =========================================================================

export function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Dialog : creer une demande
// =========================================================================

export function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<"complaint" | "problem_report" | "consumable_reorder">("complaint");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const create = useCreateClientTicket();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    try {
      await create.mutateAsync({ type, priority, subject: subject.trim(), body: body || undefined });
      toast.success("Demande envoyée — on vous recontacte rapidement.");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Envoi impossible");
    }
  };

  const TYPE_ICONS = {
    complaint: AlertCircle,
    problem_report: MessageSquare,
    consumable_reorder: PackageOpen,
  };

  return (
    <DialogContent className="sm:!max-w-lg">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TicketIcon className="h-4 w-4 text-primary" />
            Nouvelle demande
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div>
            <Label className="text-xs mb-1.5 block">Type de demande *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["complaint", "problem_report", "consumable_reorder"] as const).map((t) => {
                const Icon = TYPE_ICONS[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={
                      "p-2.5 rounded-lg border-2 text-center transition-all " +
                      (active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40")
                    }
                  >
                    <Icon className={"h-5 w-5 mx-auto mb-1 " + (active ? "text-primary" : "text-muted-foreground")} />
                    <div className="text-[11px] font-medium">{TICKET_TYPE_LABEL(t)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">Sujet *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Fuite d'eau dans la cuisine"
              required
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Détaillez votre demande…"
            />
          </div>

          <div>
            <Label className="text-xs">Urgence</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!subject.trim() || create.isPending} className="gap-1">
            {create.isPending ? "Envoi…" : <><Send className="h-3.5 w-3.5" /> Envoyer la demande</>}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
