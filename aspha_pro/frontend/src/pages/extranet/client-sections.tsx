import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Receipt, Briefcase, Download, Ticket as TicketIcon, Plus,
  AlertCircle, MessageSquare, PackageOpen, Send,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
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
  useClientTickets, useCreateClientTicket,
} from "@/hooks/use-extranet";
import { api } from "@/lib/api";

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
