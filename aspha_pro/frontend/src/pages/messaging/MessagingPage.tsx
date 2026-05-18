import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquarePlus, Send, Users, Search, Check } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
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
  useCreateThread, useMarkThreadRead, usePostMessage, useThread, useThreads,
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
          <ThreadView threadId={activeThreadId} />
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

function ThreadView({ threadId }: { threadId: number }) {
  const { data, isLoading } = useThread(threadId);
  const post = usePostMessage();
  const [body, setBody] = useState("");
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
      <CardHeader className="py-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          {data?.thread.subject ?? "(sans sujet)"}
          {data?.thread.messageThreadParticipants && (
            <Badge variant="outline" className="ml-2 gap-1">
              <Users className="h-3 w-3" />
              {data.thread.messageThreadParticipants.length}
            </Badge>
          )}
        </CardTitle>
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
 * Création de conversation — picker multi-sélect intervenants avec photo.
 *
 * Le backend MessagingController exige `participant_ids` = liste d'IDs `users`.
 * Comme on choisit visuellement des intervenants (Employee), on envoie leur
 * `user_id` (Employee.user_id pointe vers users.id). Les employees sans user_id
 * (= pas encore d'accès portail) sont affichés mais désactivés.
 */
function CreateThreadDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  // Set d'employee IDs sélectionnés. On stocke par employee.id pour l'UI,
  // on traduit en user_id à la soumission.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialMessage, setInitialMessage] = useState("");
  const create = useCreateThread();
  // On récupère 100 intervenants max — pour les fichiers > 100 personnes,
  // on s'appuiera sur le filtre `search` côté serveur.
  const { data: empData, isLoading } = useEmployees({ per_page: 100, search });
  const employees = useMemo(() => empData?.data ?? [], [empData]);

  const toggle = (empId: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Traduit les Employee.id sélectionnés en user_id (le seul accepté par le backend)
    const userIds = employees
      .filter((emp: any) => selected.has(emp.id) && emp.user_id)
      .map((emp: any) => emp.user_id as number);

    if (userIds.length === 0) {
      toast.error("Sélectionne au moins un intervenant ayant un accès portail");
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
                Intervenants à inviter *{" "}
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
                placeholder="Rechercher un intervenant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
              {isLoading && (
                <div className="p-4 text-xs text-muted-foreground italic">Chargement…</div>
              )}
              {!isLoading && employees.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucun intervenant trouvé.
                </div>
              )}
              {employees.map((emp: any) => {
                const hasUser = !!emp.user_id;
                const isSelected = selected.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => hasUser && toggle(emp.id)}
                    disabled={!hasUser}
                    className={
                      "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors " +
                      (isSelected
                        ? "bg-primary/10 hover:bg-primary/15"
                        : hasUser
                          ? "hover:bg-muted/60 cursor-pointer"
                          : "opacity-50 cursor-not-allowed")
                    }
                  >
                    <EntityAvatar
                      src={emp.avatar_url}
                      name={emp.full_name}
                      variant="employee"
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{emp.full_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {hasUser
                          ? (emp.classification === "cadre" ? "Cadre" : "Non-cadre")
                          : "⚠ Pas d'accès portail — ne peut pas recevoir de messages"}
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
