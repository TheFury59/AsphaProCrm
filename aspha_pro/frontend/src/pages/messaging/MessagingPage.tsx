import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquarePlus, Send, Users, Search, Check,
  Settings2, UserPlus, Trash2, X, Crown,
} from "lucide-react";
import { EntityAvatar } from "@/components/EntityAvatar";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  useAddParticipants, useCreateThread, useDeleteThread, useMarkThreadRead,
  useMessageableUsers, usePostMessage, useRemoveParticipant, useThread, useThreads,
} from "@/hooks/use-messaging";
import { useAuthStore } from "@/stores/auth";
import { apiErrorMessage } from "@/lib/api";

export function MessagingPage() {
  const { data: threads = [], isLoading } = useThreads();
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const markRead = useMarkThreadRead();

  useEffect(() => {
    if (activeThreadId) {
      markRead.mutate(activeThreadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  return (
    <div>
      <PageHeader
        title="Messagerie"
        description="Conversations internes entre admin et intervenants."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><MessageSquarePlus className="mr-2 h-4 w-4" />Nouvelle conversation</Button>
            </DialogTrigger>
            <CreateThreadDialog onCreated={(id) => { setActiveThreadId(id); setOpenCreate(false); }} />
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[75vh]">
        <Card className="overflow-hidden">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-base">Conversations ({threads.length})</CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(75vh-58px)]">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Chargement…</div>
            ) : threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucune conversation.</div>
            ) : (
              <ul className="divide-y">
                {threads.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={`px-4 py-3 cursor-pointer hover:bg-accent ${activeThreadId === t.id ? "bg-accent" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-medium text-sm truncate">{t.subject ?? "(sans sujet)"}</p>
                          {t.unread_count > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{t.unread_count}</Badge>
                          )}
                        </div>
                        {t.last_message && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {t.last_message.body}
                          </p>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground shrink-0">
                        {t.last_message
                          ? formatDistanceToNow(new Date(t.last_message.sent_at), { locale: fr, addSuffix: false })
                          : format(new Date(t.created_at), "dd/MM", { locale: fr })}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1">{t.type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </Card>

        {activeThreadId ? (
          <ThreadView
            threadId={activeThreadId}
            onDeleted={() => setActiveThreadId(null)}
          />
        ) : (
          <Card className="flex items-center justify-center">
            <CardContent>
              <p className="text-sm text-muted-foreground">Sélectionne une conversation pour l'ouvrir.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ThreadView({ threadId, onDeleted }: { threadId: number; onDeleted: () => void }) {
  const { data, isLoading } = useThread(threadId);
  const post = usePostMessage();
  const [body, setBody] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    post.mutate({ threadId, body }, {
      onSuccess: () => setBody(""),
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="py-3 border-b flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2 min-w-0">
          <span className="truncate">{data?.thread.subject ?? "(sans sujet)"}</span>
          {data?.thread.messageThreadParticipants && (
            <Badge variant="outline" className="gap-1 shrink-0">
              <Users className="h-3 w-3" />
              {data.thread.messageThreadParticipants.length}
            </Badge>
          )}
        </CardTitle>
        {data?.can_manage && (
          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <Settings2 className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Gérer</span>
              </Button>
            </DialogTrigger>
            <ManageThreadDialog
              threadId={threadId}
              thread={data.thread}
              onDeleted={() => { setManageOpen(false); onDeleted(); }}
            />
          </Dialog>
        )}
      </CardHeader>
      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            [...(data?.messages.data ?? [])].reverse().map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {!mine && m.sender && (
                      <p className="text-[10px] font-medium opacity-70 mb-0.5">{m.sender.name}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-[10px] mt-0.5 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                      {format(new Date(m.sent_at), "dd/MM HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      <form onSubmit={send} className="border-t p-3 flex items-end gap-2">
        <Textarea
          rows={2}
          placeholder="Ton message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e as any);
            }
          }}
          className="resize-none"
        />
        <Button type="submit" disabled={post.isPending || !body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

/**
 * Création de conversation — picker multi-sélect du personnel avec photo.
 *
 * La messagerie interne est ouverte à TOUT le personnel : on peut inviter
 * super_admin, admin ET intervenant dans la même conversation. Les clients
 * en sont exclus côté serveur (endpoint `/messaging/users` ne les renvoie
 * jamais — ils utilisent les tickets). Les IDs sélectionnés sont déjà des
 * `users.id`, directement acceptés par le backend (plus de traduction).
 */
const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super-administrateur",
  admin: "Administrateur",
  intervenant: "Intervenant",
};

function CreateThreadDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  // Set d'IDs `users` sélectionnés — directement utilisables à la soumission.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialMessage, setInitialMessage] = useState("");
  const create = useCreateThread();
  const { data: allUsers = [], isLoading } = useMessageableUsers();

  // Filtrage côté client : la liste du personnel est bornée (les clients
  // n'y figurent pas), pas besoin d'aller-retour serveur sur la recherche.
  const users = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [allUsers, search]);

  const toggle = (userId: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const userIds = [...selected];

    if (userIds.length === 0) {
      toast.error("Sélectionne au moins un participant");
      return;
    }

    create.mutate(
      {
        subject: subject || undefined,
        type: userIds.length > 1 ? "group" : "direct",
        participant_ids: userIds,
        initial_message: initialMessage || undefined,
      },
      {
        onSuccess: (t) => {
          toast.success(`Conversation créée avec ${userIds.length} participant(s)`);
          onCreated(t.id);
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <DialogContent className="sm:!max-w-2xl">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            Nouvelle conversation
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-3">
          <div className="grid gap-1">
            <Label className="text-xs">Sujet (optionnel)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Planning de la semaine du 12 mai"
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Participants à inviter *{" "}
                {selected.size > 0 && (
                  <span className="text-primary font-medium">({selected.size} sélectionné{selected.size > 1 ? "s" : ""})</span>
                )}
              </Label>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                Tout désélectionner
              </button>
            </div>

            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un membre du personnel…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
              {isLoading && (
                <div className="p-4 text-xs text-muted-foreground italic">Chargement…</div>
              )}
              {!isLoading && users.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucun membre du personnel trouvé.
                </div>
              )}
              {users.map((u) => {
                const isSelected = selected.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={
                      "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors " +
                      (isSelected
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/60 cursor-pointer")
                    }
                  >
                    <EntityAvatar
                      src={u.avatar_url ?? undefined}
                      name={u.name}
                      variant="employee"
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {ROLE_LABEL[u.role] ?? u.role} · {u.email}
                      </div>
                    </div>
                    <div
                      className={
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition " +
                        (isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30")
                      }
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Premier message (optionnel)</Label>
            <Textarea
              rows={3}
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Bonjour, …"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={create.isPending || selected.size === 0}>
            {create.isPending
              ? "Création…"
              : selected.size > 1
                ? `Créer le groupe (${selected.size})`
                : "Créer la conversation"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/**
 * Gestion d'une conversation existante (WhatsApp-like).
 *
 * Visible uniquement quand le backend renvoie `can_manage: true` — soit le
 * créateur de la conversation, soit un admin/super_admin. Permet d'ajouter
 * des participants, d'en retirer (sauf le créateur) et de supprimer la
 * conversation. Toutes les actions sont re-vérifiées côté serveur.
 */
function ManageThreadDialog({
  threadId, thread, onDeleted,
}: {
  threadId: number;
  thread: any;
  onDeleted: () => void;
}) {
  const participants: any[] = thread.messageThreadParticipants ?? [];
  const creatorId: number | null = thread.created_by ?? null;
  const currentUser = useAuthStore((s) => s.user);

  const { data: allUsers = [] } = useMessageableUsers();
  const addParticipants = useAddParticipants();
  const removeParticipant = useRemoveParticipant();
  const deleteThread = useDeleteThread();

  const [toAdd, setToAdd] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // IDs déjà dans la conversation — on les exclut du picker d'ajout.
  const presentIds = useMemo(
    () => new Set(participants.map((p) => p.user_id ?? p.user?.id)),
    [participants],
  );

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter(
      (u) =>
        !presentIds.has(u.id) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    );
  }, [allUsers, presentIds, search]);

  const toggleAdd = (id: number) => {
    setToAdd((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const ids = [...toAdd];
    if (ids.length === 0) return;
    addParticipants.mutate(
      { threadId, userIds: ids },
      {
        onSuccess: () => {
          toast.success(`${ids.length} participant(s) ajouté(s)`);
          setToAdd(new Set());
          setSearch("");
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  const handleRemove = (userId: number) => {
    removeParticipant.mutate(
      { threadId, userId },
      {
        onSuccess: () => toast.success("Participant retiré"),
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  const handleDelete = () => {
    deleteThread.mutate(threadId, {
      onSuccess: () => {
        toast.success("Conversation supprimée");
        onDeleted();
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <DialogContent className="sm:!max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Gérer la conversation
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        {/* Participants actuels */}
        <div className="grid gap-1.5">
          <Label className="text-xs">Participants ({participants.length})</Label>
          <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
            {participants.map((p) => {
              const u = p.user ?? {};
              const uid = p.user_id ?? u.id;
              const isCreator = creatorId != null && uid === creatorId;
              const isMe = currentUser?.id === uid;
              return (
                <div key={uid} className="px-3 py-2 flex items-center gap-3">
                  <EntityAvatar name={u.name ?? "?"} variant="employee" size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {u.name ?? "Utilisateur"}
                      {isMe && <span className="text-muted-foreground"> (moi)</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                  </div>
                  {isCreator ? (
                    <Badge variant="outline" className="gap-1 shrink-0 text-[10px]">
                      <Crown className="h-3 w-3" />Créateur
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      disabled={removeParticipant.isPending}
                      onClick={() => handleRemove(uid)}
                      title="Retirer de la conversation"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ajout de participants */}
        <div className="grid gap-1.5">
          <Label className="text-xs">
            Ajouter des participants
            {toAdd.size > 0 && (
              <span className="text-primary font-medium">
                {" "}({toAdd.size} sélectionné{toAdd.size > 1 ? "s" : ""})
              </span>
            )}
          </Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un membre du personnel…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
            {candidates.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Aucun membre du personnel à ajouter.
              </div>
            )}
            {candidates.map((u) => {
              const isSel = toAdd.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleAdd(u.id)}
                  className={
                    "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors " +
                    (isSel ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/60 cursor-pointer")
                  }
                >
                  <EntityAvatar
                    src={u.avatar_url ?? undefined}
                    name={u.name}
                    variant="employee"
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {ROLE_LABEL[u.role] ?? u.role}
                    </div>
                  </div>
                  <div
                    className={
                      "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition " +
                      (isSel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30")
                    }
                  >
                    {isSel && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={toAdd.size === 0 || addParticipants.isPending}
            onClick={handleAdd}
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            {addParticipants.isPending ? "Ajout…" : "Ajouter à la conversation"}
          </Button>
        </div>

        {/* Zone danger — suppression */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          {!confirmDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Supprimer la conversation
            </Button>
          ) : (
            <div className="grid gap-2">
              <p className="text-xs text-destructive font-medium">
                Action irréversible — tous les messages seront définitivement perdus. Confirmer&nbsp;?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={deleteThread.isPending}
                  onClick={handleDelete}
                >
                  {deleteThread.isPending ? "Suppression…" : "Oui, supprimer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
}
