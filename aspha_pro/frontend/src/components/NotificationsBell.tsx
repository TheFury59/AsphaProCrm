import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
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
import { getNotificationStyle, getNotificationLink } from "@/lib/notification-styles";
import { useAuthStore } from "@/stores/auth";

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
  const { data: notifications = [] } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  // Les rôles non-admin ne peuvent pas naviguer vers les routes du CRM admin :
  // en contexte extranet, les deep-links pointent vers l'espace client.
  const role = useAuthStore((s) => s.user?.role);
  const isExtranet = role === "client" || role === "intervenant";

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

        <ScrollArea className="h-[480px]">
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

                return (
                  <li
                    key={n.id}
                    className={
                      "group flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors border-l-4 " +
                      style.border +
                      (!n.is_read ? " bg-accent/30" : " border-l-transparent")
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
      </PopoverContent>
    </Popover>
  );
}
