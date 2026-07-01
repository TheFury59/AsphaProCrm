import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertCircle, MessageSquare, PackageOpen,
  Building2, Calendar, User, Trash2, ArrowRight, Users, Plus, X,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityAvatar } from "@/components/EntityAvatar";
import { TicketThread } from "@/components/TicketThread";
import { apiErrorMessage } from "@/lib/api";
import {
  useTicket, useUpdateTicket, useDeleteTicket,
  useTicketMessages, usePostTicketMessage,
  useAttachTicketEmployee, useDetachTicketEmployee,
  useSetTicketFault,
  type TicketStatus, type TicketPriority, type ClientRequest,
} from "@/hooks/use-tickets";
import { useEmployees } from "@/hooks/use-employees";
import { useAuthStore } from "@/stores/auth";
import { confirm } from "@/components/ui/confirm";

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
  const currentUser = useAuthStore((s) => s.user);
  const { data: t, isLoading } = useTicket(ticketId);
  const update = useUpdateTicket();
  const del = useDeleteTicket();
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticketId);
  const postMessage = usePostTicketMessage(ticketId ?? 0);

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
    if (!(await confirm({ title: "Supprimer le ticket", description: "Supprimer ce ticket ? Cette action est irréversible.", confirmLabel: "Supprimer", variant: "danger" }))) return;
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

          {/* Fil de discussion — échange admin / client / intervenants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Fil de discussion
              </CardTitle>
              <CardDescription>
                Échangez avec le client et les intervenants affectés. Tous les
                participants reçoivent une notification à chaque message.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TicketThread
                messages={messages}
                isLoading={messagesLoading}
                currentUserId={currentUser?.id ?? null}
                isSending={postMessage.isPending}
                onSend={async (body) => {
                  await postMessage.mutateAsync(body);
                }}
              />
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

          {/* Intervenants affectés au ticket */}
          <AssignedEmployeesCard ticketId={ticketId} assigned={t.assigned_employees ?? []} />

          {/* Désignation de l'intervenant responsable (système de notation) */}
          <FaultCard ticketId={ticketId} ticket={t} />
        </div>
      </div>
    </div>
  );
}

/**
 * Carte « Intervenant responsable » — l'admin désigne quel intervenant est
 * fautif pour ce ticket. La sélection est restreinte aux intervenants
 * affectés au ticket. Imputer une faute pénalise le critère « relation »
 * de la note de l'intervenant.
 */
function FaultCard({ ticketId, ticket }: { ticketId: number; ticket: ClientRequest }) {
  const assigned = ticket.assigned_employees ?? [];
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string>(
    ticket.fault_employee_id ? String(ticket.fault_employee_id) : "",
  );
  const [comment, setComment] = useState<string>(ticket.fault_comment ?? "");
  const setFault = useSetTicketFault(ticketId);

  const faultEmployee = ticket.fault_employee ?? null;

  const handleSave = async () => {
    if (!selected) {
      toast.error("Sélectionnez l'intervenant responsable, ou utilisez « Retirer la faute ».");
      return;
    }
    try {
      await setFault.mutateAsync({
        fault_employee_id: parseInt(selected, 10),
        fault_comment: comment.trim() || null,
      });
      toast.success("Intervenant responsable enregistré.");
      setEditing(false);
    } catch (err) {
      console.error("setFault failed", { ticketId, selected, comment, err });
      toast.error(apiErrorMessage(err, "Enregistrement impossible"));
    }
  };

  const handleClear = async () => {
    try {
      await setFault.mutateAsync({ fault_employee_id: null, fault_comment: null });
      toast.success("Faute retirée.");
      setSelected("");
      setComment("");
      setEditing(false);
    } catch (err) {
      console.error("clearFault failed", { ticketId, err });
      toast.error(apiErrorMessage(err, "Retrait impossible"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Intervenant responsable
        </CardTitle>
        <CardDescription>
          Désigner un intervenant comme fautif pénalise sa note (critère « relation »).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* État courant : faute imputée ou non */}
        {faultEmployee ? (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2.5">
            <EntityAvatar
              src={faultEmployee.avatar_url}
              name={faultEmployee.name ?? `Intervenant #${faultEmployee.id}`}
              variant="employee"
              size="xs"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {faultEmployee.name ?? `Intervenant #${faultEmployee.id}`}
              </div>
              {ticket.fault_comment && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 whitespace-pre-wrap">
                  {ticket.fault_comment}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Aucune faute imputée pour ce ticket.
          </p>
        )}

        {!editing && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSelected(ticket.fault_employee_id ? String(ticket.fault_employee_id) : "");
                setComment(ticket.fault_comment ?? "");
                setEditing(true);
              }}
            >
              {faultEmployee ? "Modifier" : "Désigner un responsable"}
            </Button>
            {faultEmployee && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-rose-600"
                onClick={handleClear}
                disabled={setFault.isPending}
              >
                Retirer la faute
              </Button>
            )}
          </div>
        )}

        {editing && (
          <div className="space-y-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir parmi les intervenants affectés…" />
              </SelectTrigger>
              <SelectContent>
                {assigned.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Affectez d'abord un intervenant au ticket.
                  </div>
                )}
                {assigned.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name ?? `Intervenant #${e.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={comment}
              onChange={(ev) => setComment(ev.target.value)}
              placeholder="Commentaire (optionnel) — contexte de la faute"
              rows={3}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleSave} disabled={setFault.isPending}>
                Enregistrer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Carte de gestion des intervenants affectés au ticket. Un intervenant
 * affecté devient participant du fil : il voit le ticket dans son extranet.
 */
function AssignedEmployeesCard({
  ticketId,
  assigned,
}: {
  ticketId: number;
  assigned: { id: number; name: string | null; avatar_url?: string | null }[];
}) {
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState("");
  const { data: employeesPage } = useEmployees({ per_page: 100 });
  const attach = useAttachTicketEmployee(ticketId);
  const detach = useDetachTicketEmployee(ticketId);

  const allEmployees = employeesPage?.data ?? [];
  const assignedIds = new Set(assigned.map((e) => e.id));
  const candidates = allEmployees.filter((e: any) => !assignedIds.has(e.id));

  const handleAttach = async () => {
    if (!selected) {
      toast.error("Sélectionnez un intervenant");
      return;
    }
    try {
      await attach.mutateAsync(parseInt(selected, 10));
      toast.success("Intervenant affecté — il a été notifié.");
      setSelected("");
      setPicking(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Affectation impossible");
    }
  };

  const handleDetach = async (employeeId: number) => {
    try {
      await detach.mutateAsync(employeeId);
      toast.success("Intervenant retiré du ticket");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Retrait impossible");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Intervenants ({assigned.length})
        </CardTitle>
        {!picking && (
          <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Affecter
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {picking && (
          <div className="flex items-center gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choisir un intervenant…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Tous les intervenants sont déjà affectés.
                  </div>
                )}
                {candidates.map((e: any) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name ?? `Intervenant #${e.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={attach.isPending} onClick={handleAttach}>
              OK
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setPicking(false); setSelected(""); }}
            >
              Annuler
            </Button>
          </div>
        )}

        {assigned.length === 0 && !picking && (
          <p className="text-xs text-muted-foreground italic">
            Aucun intervenant affecté. Affectez-en un pour l'inclure dans le fil.
          </p>
        )}

        {assigned.map((e) => (
          <div key={e.id} className="flex items-center gap-2.5 group">
            <EntityAvatar
              src={e.avatar_url}
              name={e.name ?? `Intervenant #${e.id}`}
              variant="employee"
              size="xs"
            />
            <span className="text-sm flex-1 truncate">{e.name ?? `Intervenant #${e.id}`}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-rose-600"
              onClick={() => handleDetach(e.id)}
              disabled={detach.isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
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
