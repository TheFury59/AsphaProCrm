import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { TicketMessage } from "@/hooks/use-tickets";

/**
 * Fil de discussion d'un ticket — composant partagé par les 3 publics
 * (admin TicketDetailPage, extranet client, extranet intervenant).
 *
 * Reçoit les données + le callback d'envoi par props : aucun couplage au
 * canal d'API (admin vs extranet). Les messages de l'utilisateur courant
 * sont alignés à droite, les autres à gauche.
 */
export function TicketThread({
  messages,
  isLoading,
  currentUserId,
  onSend,
  isSending,
  disabled,
}: {
  messages: TicketMessage[] | undefined;
  isLoading: boolean;
  currentUserId: number | null;
  onSend: (body: string) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le dernier message à chaque mise à jour du fil.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) {
      toast.error("Écrivez un message avant d'envoyer.");
      return;
    }
    try {
      await onSend(body);
      setDraft("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Envoi du message impossible");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Liste des messages */}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {isLoading && (
          <>
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-14 w-2/3 ml-auto" />
          </>
        )}
        {!isLoading && (messages?.length ?? 0) === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Aucun message pour le moment. Démarrez la conversation.
          </div>
        )}
        {messages?.map((m) => {
          const mine = currentUserId != null && m.sender_id === currentUserId;
          return (
            <div
              key={m.id}
              className={"flex flex-col max-w-[80%] " + (mine ? "ml-auto items-end" : "items-start")}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium">
                  {mine ? "Vous" : m.sender?.name ?? "Utilisateur"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { locale: fr, addSuffix: true })}
                </span>
              </div>
              <div
                className={
                  "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed " +
                  (mine
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm")
                }
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {!disabled && (
        <form onSubmit={submit} className="border-t pt-3 space-y-2">
          <Textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écrire un message…"
            className="text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Ctrl + Entrée pour envoyer</span>
            <Button type="submit" size="sm" disabled={isSending} className="gap-1.5">
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Envoyer
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
