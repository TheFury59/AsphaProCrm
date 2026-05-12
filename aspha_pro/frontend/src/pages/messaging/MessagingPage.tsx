import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Send, Users } from "lucide-react";
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

function CreateThreadDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [subject, setSubject] = useState("");
  const [participantIds, setParticipantIds] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const create = useCreateThread();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ids = participantIds.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    if (ids.length === 0) {
      toast.error("Au moins un participant requis");
      return;
    }
    create.mutate(
      { subject: subject || undefined, type: ids.length > 1 ? "group" : "direct", participant_ids: ids, initial_message: initialMessage || undefined },
      {
        onSuccess: (t) => { toast.success("Conversation créée"); onCreated(t.id); },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid gap-1">
            <Label>Sujet (optionnel)</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Participants (IDs séparés par virgule) *</Label>
            <Input
              required
              placeholder="ex: 2, 5, 8"
              value={participantIds}
              onChange={(e) => setParticipantIds(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label>Premier message (optionnel)</Label>
            <Textarea rows={3} value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "…" : "Créer"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
