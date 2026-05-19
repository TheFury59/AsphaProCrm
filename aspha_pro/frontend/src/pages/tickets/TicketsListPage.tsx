import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ClickableRow } from "@/components/ClickableRow";
import {
  Ticket as TicketIcon, Search, Plus, AlertCircle, MessageSquare,
  PackageOpen, ChevronRight, ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EntityAvatar } from "@/components/EntityAvatar";
import { useClients } from "@/hooks/use-clients";
import {
  useTickets, useCreateTicket,
  type TicketType, type TicketStatus, type TicketPriority,
} from "@/hooks/use-tickets";

// =========================================================================
// Constants UI (labels, couleurs, icônes)
// =========================================================================

const TYPE_META: Record<TicketType, { label: string; icon: typeof AlertCircle; color: string }> = {
  complaint: { label: "Réclamation", icon: AlertCircle, color: "text-rose-600" },
  problem_report: { label: "Signalement", icon: MessageSquare, color: "text-amber-600" },
  consumable_reorder: { label: "Commande conso.", icon: PackageOpen, color: "text-sky-600" },
};

const STATUS_META: Record<TicketStatus, { label: string; bg: string }> = {
  open: { label: "Ouvert", bg: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  in_progress: { label: "En cours", bg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  resolved: { label: "Résolu", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  closed: { label: "Fermé", bg: "bg-muted text-muted-foreground" },
};

const PRIORITY_META: Record<TicketPriority, { label: string; bg: string }> = {
  low: { label: "Faible", bg: "bg-slate-100 text-slate-600" },
  normal: { label: "Normale", bg: "bg-sky-100 text-sky-700" },
  high: { label: "Haute", bg: "bg-amber-100 text-amber-700" },
  urgent: { label: "Urgente", bg: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

// =========================================================================
// Page
// =========================================================================

export function TicketsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [type, setType] = useState<TicketType | "all">("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useTickets({
    page,
    per_page: 25,
    search,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
  });

  const rows = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Tickets clients"
        description="Réclamations, signalements et commandes de consommables."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95">
                <Plus className="h-4 w-4 mr-1.5" /> Nouveau ticket
              </Button>
            </DialogTrigger>
            <CreateTicketDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        }
      />

      {/* Filtres */}
      <div className="mb-5 px-4 py-3 rounded-2xl bg-card shadow-soft flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sujet, contenu, client…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 border-0 bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="open">Ouverts</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="resolved">Résolus</SelectItem>
            <SelectItem value="closed">Fermés</SelectItem>
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => { setType(v as any); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="complaint">Réclamations</SelectItem>
            <SelectItem value="problem_report">Signalements</SelectItem>
            <SelectItem value="consumable_reorder">Commandes conso.</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md ml-auto">
          <span className="font-medium text-foreground">{data?.meta.total ?? 0}</span> ticket{(data?.meta.total ?? 0) > 1 ? "s" : ""}
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Type</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Sujet</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Client</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Priorité</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Statut</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Créé</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={`s-${i}`}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <TicketIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <div className="text-sm text-muted-foreground">Aucun ticket.</div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Créer le premier
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {rows.map((t) => {
              const TypeIcon = TYPE_META[t.type].icon;
              const companyName = t.client?.company?.company_name ?? `Client #${t.client_id}`;
              return (
                <ClickableRow key={t.id} to={`/tickets/${t.id}`} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TypeIcon className={`h-4 w-4 ${TYPE_META[t.type].color}`} />
                      <span className="text-xs font-medium">{TYPE_META[t.type].label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium truncate max-w-[280px]">{t.subject || <em className="text-muted-foreground">(sans sujet)</em>}</div>
                    {t.body && (
                      <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-[280px]">{t.body}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to={`/clients/${t.client_id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <EntityAvatar
                        src={t.client?.company?.logo_url}
                        name={companyName}
                        variant="client"
                        size="xs"
                      />
                      <span className="text-sm">{companyName}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {t.priority ? (
                      <Badge className={PRIORITY_META[t.priority].bg}>{PRIORITY_META[t.priority].label}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_META[t.status].bg}>{STATUS_META[t.status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { locale: fr, addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Link to={`/tickets/${t.id}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-60 group-hover:opacity-100">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </ClickableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {data.meta.current_page} / {data.meta.last_page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Création ticket avec picker client (logo)
// =========================================================================

function CreateTicketDialog({ onClose }: { onClose: () => void }) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [type, setType] = useState<TicketType>("complaint");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const { data: clientsData } = useClients({ per_page: 25, search: clientSearch, status: "active" });
  const clients = useMemo(() => clientsData?.data ?? [], [clientsData]);
  const selectedClient = clients.find((c) => c.id === clientId);

  const createTicket = useCreateTicket();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !subject.trim()) return;
    try {
      await createTicket.mutateAsync({
        client_id: clientId,
        type,
        priority,
        subject: subject.trim(),
        body: body || null,
        status: "open",
      });
      toast.success("Ticket créé");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Création impossible");
    }
  };

  return (
    <DialogContent className="sm:!max-w-xl">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TicketIcon className="h-4 w-4 text-primary" />
            Nouveau ticket client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {/* Picker client avec logo */}
          <div>
            <Label className="text-xs">Client *</Label>
            {selectedClient ? (
              <div className="flex items-center gap-3 p-2.5 rounded-lg border-2 border-primary/30 bg-primary/5">
                <EntityAvatar
                  src={selectedClient.company?.logo_url}
                  name={selectedClient.company?.company_name ?? selectedClient.display_name}
                  variant="client"
                  size="md"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {selectedClient.company?.company_name ?? selectedClient.display_name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{selectedClient.code}</div>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setClientId(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un client…"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-9 h-9"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center gap-3 group"
                    >
                      <EntityAvatar
                        src={c.company?.logo_url}
                        name={c.company?.company_name ?? c.display_name}
                        variant="client"
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.company?.company_name ?? c.display_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">{c.code}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="complaint">Réclamation</SelectItem>
                  <SelectItem value="problem_report">Signalement de problème</SelectItem>
                  <SelectItem value="consumable_reorder">Commande de consommable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
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

          <div>
            <Label className="text-xs">Sujet *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Fuite d'eau dans la cuisine"
              required
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Détails de la demande…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!clientId || !subject.trim() || createTicket.isPending}>
            {createTicket.isPending ? "Création…" : "Créer le ticket"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
