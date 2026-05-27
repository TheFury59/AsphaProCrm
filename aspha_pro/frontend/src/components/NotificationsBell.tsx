import { useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, ExternalLink, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useMarkAllRead, useMarkRead, useNotifications, useUnreadCount,
} from "@/hooks/use-operations";
import {
  getNotificationStyle, getNotificationLink, getPriorityClasses,
} from "@/lib/notification-styles";
import { useAuthStore } from "@/stores/auth";

/**
 * Bip court (Web Audio) joué à l'arrivée d'une notification haute priorité.
 * Pas d'asset audio : oscillateur synthétisé. Échoue silencieusement si le
 * navigateur bloque l'audio (pas d'interaction utilisateur préalable, contexte
 * suspendu, navigateur sans Web Audio, etc.).
 *
 * CRITIQUE : cette fonction ne doit JAMAIS throw. La cloche est montée sur
 * toutes les pages (admin + extranet) — un throw ici = page blanche partout.
 * D'où le double try/catch et toutes les guards sur `typeof window`.
 */
function playPriorityBeep() {
  try {
    if (typeof window === "undefined") return;
    const Ctx =
      (window as any).AudioContext ||
      (window as any).webkitAudioContext;
    if (typeof Ctx !== "function") return;
    let ctx: AudioContext;
    try {
      ctx = new Ctx();
    } catch {
      // Certains navigateurs throw si l'AudioContext est créé sans
      // interaction utilisateur (politique autoplay). On abandonne en silence.
      return;
    }
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
      osc.onended = () => { try { ctx.close(); } catch { /* noop */ } };
    } catch {
      try { ctx.close(); } catch { /* noop */ }
    }
  } catch {
    // Audio indisponible — on ignore (le surlignage visuel reste).
  }
}

/**
 * Cloche de notifications avec rendu typé.
 *
 * Chaque notification est stylée selon notification_type.code :
 * - icône Lucide dédiée
 * - couleur de la border-left
 * - badge module (Réservation, Ticket, Message…)
 *
 * Cf. lib/notification-styles.ts pour le mapping complet.
 */
export function NotificationsBell() {
  const { data: notificationsRaw } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  // Les rôles non-admin ne peuvent pas naviguer vers les routes du CRM admin :
  // en contexte extranet, les deep-links pointent vers l'espace client.
  const role = useAuthStore((s) => s.user?.role);
  const isExtranet = role === "client" || role === "intervenant";

  // Garde défensive : si l'API renvoie quelque chose d'inattendu (objet,
  // erreur silencieuse, payload non normalisé…), on tombe sur un array vide
  // plutôt que de laisser `.filter` / `.map` throw → page blanche.
  const notifications = Array.isArray(notificationsRaw) ? notificationsRaw : [];

  // Anti-spam sonore : on mémorise les ids des notifs haute priorité non lues
  // déjà « vues » par ce composant. Le bip ne joue qu'une fois par notif.
  const seenPriorityIds = useRef<Set<number>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    // Try/catch global : la cloche est montée sur toutes les pages — toute
    // exception ici ferait écran blanc partout. Mieux vaut perdre le bip.
    try {
      const highUnread = notifications.filter(
        (n) =>
          n &&
          !n.is_read &&
          (n.priority === "high" || n.priority === "critical"),
      );

      // Premier rendu : on amorce le set sans jouer de son (sinon bip à chaque
      // rechargement de page pour des notifs déjà existantes).
      if (!primed.current) {
        highUnread.forEach((n) => seenPriorityIds.current.add(n.id));
        primed.current = true;
        return;
      }

      const fresh = highUnread.filter((n) => !seenPriorityIds.current.has(n.id));
      if (fresh.length > 0) {
        playPriorityBeep(); // un seul bip, quel que soit le nombre de nouvelles
        fresh.forEach((n) => seenPriorityIds.current.add(n.id));
      }
    } catch (e) {
      // Ne JAMAIS remonter une exception : la cloche doit rester silencieuse
      // si quelque chose tourne mal (payload imprévu, etc.).
      console.warn("NotificationsBell: priority beep effect failed", e);
    }
  }, [notifications]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative cursor-pointer hover:bg-accent">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-aspha text-white text-[9px] font-medium px-1 ring-2 ring-background shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{unreadCount} nouveau{unreadCount > 1 ? "x" : ""}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Tout marquer lu
            </Button>
          )}
        </div>

        <ScrollArea className="h-[440px]">
          {notifications.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const code = n.notificationType?.code ?? n.notification_type?.code;
                const style = getNotificationStyle(code);
                const Icon = style.icon;
                const link = getNotificationLink(n.target_type, n.target_id, isExtranet);
                const isUrgent =
                  !n.is_read &&
                  (n.priority === "high" || n.priority === "critical");
                const priorityClasses = getPriorityClasses(n.priority);

                return (
                  <li
                    key={n.id}
                    className={
                      "group flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors border-l-4 " +
                      style.border +
                      (!n.is_read ? " bg-accent/30" : " border-l-transparent") +
                      (priorityClasses ? " " + priorityClasses : "")
                    }
                  >
                    {/* Icône typée */}
                    <div className={"shrink-0 mt-0.5 " + style.color}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={"text-[9px] h-4 px-1.5 " + style.bg}>
                          {style.module}
                        </Badge>
                        {isUrgent && (
                          <Badge
                            variant="destructive"
                            className="text-[9px] h-4 px-1.5 inline-flex items-center gap-0.5"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {n.priority === "critical" ? "Critique" : "Urgent"}
                          </Badge>
                        )}
                        <p className="text-sm font-medium leading-tight">
                          {n.title ?? "Notification"}
                        </p>
                      </div>

                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                        {link && (
                          <Link
                            to={link}
                            className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                            onClick={() => !n.is_read && markRead.mutate(n.id)}
                          >
                            Ouvrir
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => markRead.mutate(n.id)}
                        title="Marquer comme lu"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {/* Accès à la page « Centre de notifications » (CRM admin uniquement —
            les extranets n'ont pas cette route). */}
        {!isExtranet && (
          <div className="border-t px-4 py-2">
            <Link
              to="/notifications"
              className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
            >
              Voir toutes les notifications
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
