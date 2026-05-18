import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Ticket as TicketIcon, AlertCircle, MessageSquare, PackageOpen,
  Building2, Calendar, User, Trash2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityAvatar } from "@/components/EntityAvatar";
import {
  useTicket, useUpdateTicket, useDeleteTicket,
  type TicketStatus, type TicketPriority,
} from "@/hooks/use-tickets";

/**
 * Page détail d'un ticket — accessible via la cloche notif, la liste tickets,
 * et la fiche client (à terme).
 *
 * URL : /tickets/:id
 *
 * Layout 2/3 + 1/3 :
 *  - Gauche : sujet + body + actions sur statut/priorité (gros)
 *  - Droite : client (avec logo), assigné, dates, suppression
 */

const TYPE_META = {
  complaint: { label: "Réclamation", icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-100 text-rose-700" },
  problem_report: { label: "Signalement", icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-100 text-amber-700" },
  consumable_reorder: { label: "Commande conso.", icon: PackageOpen, color: "text-sky-600", bg: "bg-sky-100 text-sky-700" },
} as const;

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Faible",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const PRIORITY_BG: Record<TicketPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

const STATUS_BG: Record<TicketStatus, string> = {
  open: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

export function TicketDetailPage() {
  const { id } = useParams();
  const ticketId = id ? parseInt(id, 10) : null;
  const navigate = useNavigate();
  const { data: t, isLoading } = useTicket(ticketId);
  const update = useUpdateTicket();
  const del = useDeleteTicket();
  // Note interne saisie côté admin — non persistée pour l'instant
  // (champ body de la table est utilisé par le ticket initial). Une
  // future itération ajoutera une table comments rattachée au ticket.
  const [internalNote, setInternalNote] = useState("");

  if (isLoading || !t || !ticketId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const typeMeta = TYPE_META[t.type];
  const TypeIcon = typeMeta.icon;
  const companyName = t.client?.company?.company_name ?? `Client #${t.client_id}`;

  const handleStatusChange = async (status: TicketStatus) => {
    try {
      await update.mutateAsync({ id: ticketId, patch: { status } });
      toast.success(`Statut → ${STATUS_LABEL[status]}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Mise à jour impossible");
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    try {
      await update.mutateAsync({ id: ticketId, patch: { priority } });
      toast.success(`Priorité → ${PRIORITY_LABEL[priority]}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Mise à jour impossible");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce ticket ? Cette action est irréversible.")) return;
    try {
      await del.mutateAsync(ticketId);
      toast.success("Ticket supprimé");
      navigate("/tickets");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Suppression impossible");
    }
  };

  return (
    <div>
      <PageHeader
        title={t.subject ?? "(sans sujet)"}
        description={`Ticket #${t.id} · créé ${formatDistanceToNow(new Date(t.created_at), { locale: fr, addSuffix: true })}`}
        backTo="/tickets"
        actions={
          <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Supprimer
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ============================================================ */}
        {/* COLONNE PRINCIPALE (2/3)                                     */}
        {/* ============================================================ */}
        <div className="lg:col-span-2 space-y-4">
          {/* Identité du ticket */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className={"h-10 w-10 rounded-lg flex items-center justify-center " + typeMeta.bg}>
                  <TypeIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl">{t.subject ?? "(sans sujet)"}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge className={typeMeta.bg + " text-[10px] h-5"}>{typeMeta.label}</Badge>
                    <Badge className={STATUS_BG[t.status] + " text-[10px] h-5"}>{STATUS_LABEL[t.status]}</Badge>
                    {t.priority && (
                      <Badge className={PRIORITY_BG[t.priority] + " text-[10px] h-5"}>
                        Priorité {PRIORITY_LABEL[t.priority]}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Description
              </div>
              {t.body ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{t.body}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">Aucune description fournie.</p>
              )}
            </CardContent>
          </Card>

          {/* Actions rapides : changer statut / priorité */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gestion du ticket</CardTitle>
              <CardDescription>Modifier statut, priorité, assignation.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
                  Statut
                </label>
                <Select
                  value={t.status}
                  onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                  disabled={update.isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Ouvert</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                    <SelectItem value="closed">Fermé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
                  Priorité
                </label>
                <Select
                  value={t.priority ?? "normal"}
                  onValueChange={(v) => handlePriorityChange(v as TicketPriority)}
                  disabled={update.isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Note interne — placeholder pour évolution future */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes internes</CardTitle>
              <CardDescription>
                Échanges et historique de traitement (à venir : commentaires persistés).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                placeholder="Écrire une note interne…"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                Bientôt : ajouter des commentaires datés visibles uniquement par les admins.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* SIDEBAR (1/3)                                                */}
        {/* ============================================================ */}
        <div className="space-y-4">
          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                to={`/clients/${t.client_id}`}
                className="flex items-center gap-3 group hover:opacity-90"
              >
                <EntityAvatar
                  src={t.client?.company?.logo_url}
                  name={companyName}
                  variant="client"
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm group-hover:text-primary transition-colors">
                    {companyName}
                  </div>
                  {t.client?.code && (
                    <div className="text-[10px] text-muted-foreground font-mono">{t.client.code}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </CardContent>
          </Card>

          {/* Métadonnées */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Type" value={typeMeta.label} icon={TypeIcon} />
              <Row
                label="Créé"
                value={format(new Date(t.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                icon={Calendar}
              />
              {t.resolved_at && (
                <Row
                  label="Résolu"
                  value={format(new Date(t.resolved_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                  icon={Calendar}
                />
              )}
              <Row
                label="Assigné"
                value={(t.assignedTo as any)?.name ?? "—"}
                icon={User}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: any }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="text-right truncate font-medium">{value}</span>
    </div>
  );
}
