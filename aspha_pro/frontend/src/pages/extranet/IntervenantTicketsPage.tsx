import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Ticket as TicketIcon, Plus, AlertCircle, MessageSquare, PackageOpen, Send,
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
  useIntervenantTickets, useIntervenantMyClients, useCreateIntervenantTicket,
} from "@/hooks/use-extranet";

/**
 * Page extranet intervenant — Signalements.
 *
 * L'intervenant peut signaler des problèmes à propos d'un de SES clients
 * (= clients chez qui il a déjà au moins une intervention).
 *
 * Route : /extranet/intervenant/signalements
 *
 * Garde-fou backend : impossible de créer un ticket pour un client chez
 * qui l'intervenant n'a pas d'intervention (403). Côté UI on ne propose
 * dans le picker que les clients valides.
 */

const TICKET_TYPE_LABEL = (t: string): string => ({
  complaint: "Réclamation",
  problem_report: "Signalement",
  consumable_reorder: "Commande conso.",
} as Record<string, string>)[t] ?? t;

const TICKET_STATUS_LABEL = (s: string): string => ({
  open: "Ouverte",
  in_progress: "En cours",
  resolved: "Résolue",
  closed: "Fermée",
} as Record<string, string>)[s] ?? s;

export function IntervenantTicketsPage() {
  const { data: tickets = [] } = useIntervenantTickets();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mes signalements</h1>
          <p className="text-sm text-muted-foreground">
            Signale un problème ou une demande pour un de tes clients. L'équipe Aspha sera notifiée.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95">
              <Plus className="h-4 w-4 mr-1.5" /> Nouveau signalement
            </Button>
          </DialogTrigger>
          <NewTicketDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TicketIcon className="h-4 w-4" /> Mes signalements ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    <TicketIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Aucun signalement pour le moment.
                  </TableCell>
                </TableRow>
              )}
              {tickets.map((t: any) => {
                const companyName = t.client?.company?.company_name ?? `Client #${t.client_id}`;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <EntityAvatar
                          src={t.client?.company?.logo_url}
                          name={companyName}
                          variant="client"
                          size="xs"
                        />
                        <span className="text-sm">{companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{TICKET_TYPE_LABEL(t.type)}</TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[260px]">
                      {t.subject ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={t.priority === "urgent" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// =========================================================================
// Dialog : nouveau signalement
// =========================================================================

function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const { data: myClients = [] } = useIntervenantMyClients();
  const create = useCreateIntervenantTicket();

  const [clientId, setClientId] = useState<string>("");
  const [type, setType] = useState<"complaint" | "problem_report" | "consumable_reorder">("problem_report");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Sélectionne un client");
      return;
    }
    if (!subject.trim()) {
      toast.error("Renseigne un sujet");
      return;
    }
    try {
      await create.mutateAsync({
        client_id: parseInt(clientId, 10),
        type,
        priority,
        subject: subject.trim(),
        body: body || undefined,
      });
      toast.success("Signalement envoyé — l'équipe Aspha a été notifiée.");
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
            Nouveau signalement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div>
            <Label className="text-xs">Client concerné *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder={myClients.length ? "Sélectionner un client…" : "Aucun client trouvé"} />
              </SelectTrigger>
              <SelectContent>
                {myClients.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.company?.company_name ?? c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Seuls les clients chez qui tu interviens apparaissent.
            </p>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Type *</Label>
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
                      (active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")
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
              placeholder="Ex: Pas d'accès au logement"
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
              placeholder="Détails du problème ou de la demande…"
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
          <Button type="submit" disabled={!clientId || !subject.trim() || create.isPending} className="gap-1">
            {create.isPending ? "Envoi…" : <><Send className="h-3.5 w-3.5" /> Envoyer le signalement</>}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
