import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, Check, ExternalLink, Search, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import {
  useNotificationHistory, useNotificationTypes, useMarkRead, useMarkAllRead,
  type Notification,
} from "@/hooks/use-operations";
import { getNotificationStyle, getNotificationLink } from "@/lib/notification-styles";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * Centre de notifications — page dédiée listant TOUTES les notifications de
 * l'utilisateur (paginées + filtrables), pour s'y retrouver mieux que dans la
 * cloche (qui reste limitée à 50, sans filtre).
 *
 * - Endpoint dédié `/notifications/history` (la cloche garde `/notifications`).
 * - Réutilise `notification-styles.ts` (icône/couleur/module par code) et la
 *   logique de deep-link de `NotificationsBell.tsx`.
 * - Conventions projet : validation au clic, mutations try/catch +
 *   `toast.error(apiErrorMessage(...))`, boutons de filtre `type="button"`.
 */
const PER_PAGE = 25;

type StatusFilter = "" | "unread" | "read";

export function NotificationCenterPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const isExtranet = role === "client" || role === "intervenant";

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("");
  const [typeCode, setTypeCode] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: types } = useNotificationTypes();
  const { data, isLoading, isFetching } = useNotificationHistory({
    page,
    per_page: PER_PAGE,
    status: status || undefined,
    type: typeCode === "all" ? undefined : typeCode,
    search: search || undefined,
  });

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const rows: Notification[] = data?.data ?? [];
  const lastPage = data?.last_page ?? 1;
  const total = data?.total ?? 0;

  // Réinitialise la pagination quand un filtre change.
  const resetTo = (fn: () => void) => { fn(); setPage(1); };

  const handleSearch = () => resetTo(() => setSearch(searchInput.trim()));

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success("Toutes les notifications ont été marquées comme lues");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Échec du marquage des notifications"));
      console.error("markAllRead échoué", e);
    }
  };

  // Clic sur une notification : marque comme lue + deep-link contextuel
  // (même logique que la cloche).
  const handleOpen = async (n: Notification) => {
    const link = getNotificationLink(n.target_type, n.target_id, isExtranet);
    try {
      if (!n.is_read) await markRead.mutateAsync(n.id);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Échec du marquage de la notification"));
      console.error("markRead échoué", e);
    }
    if (link) navigate(link);
  };

  const handleMarkOne = async (n: Notification) => {
    try {
      await markRead.mutateAsync(n.id);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Échec du marquage de la notification"));
      console.error("markRead échoué", e);
    }
  };

  // Types regroupés par module pour le sélecteur.
  const typeGroups = useMemo(() => {
    const groups: Record<string, { code: string; label: string }[]> = {};
    (types ?? []).forEach((t) => {
      (groups[t.module] ??= []).push({ code: t.code, label: t.label });
    });
    return groups;
  }, [types]);

  return (
    <div>
      <PageHeader
        title="Centre de notifications"
        description="Toutes vos notifications — historique complet, filtrable et paginé."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
            className="cursor-pointer"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Tout marquer comme lu
          </Button>
        }
      />

      {/* Filtres */}
      <Card className="rounded-2xl shadow-soft mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Statut : tout / non lues / lues */}
            {([
              { value: "", label: "Toutes" },
              { value: "unread", label: "Non lues" },
              { value: "read", label: "Lues" },
            ] as { value: StatusFilter; label: string }[]).map((opt) => (
              <Button
                key={opt.value || "all"}
                type="button"
                size="sm"
                variant={status === opt.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => resetTo(() => setStatus(opt.value))}
              >
                {opt.label}
              </Button>
            ))}

            {/* Type de notification (groupé par module) */}
            <Select
              value={typeCode}
              onValueChange={(v) => resetTo(() => setTypeCode(v))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(typeGroups).map(([module, items]) => (
                  <div key={module}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {module}
                    </div>
                    {items.map((it) => (
                      <SelectItem key={it.code} value={it.code}>{it.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recherche texte */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans le titre ou le contenu"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleSearch} className="cursor-pointer">
              Rechercher
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => resetTo(() => { setSearch(""); setSearchInput(""); })}
                className="cursor-pointer"
              >
                Effacer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card className="rounded-2xl shadow-soft">
        <CardContent className="p-0">
          {isLoading ? (
            <ul className="divide-y">
              {[...Array(6)].map((_, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-4">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                {status || typeCode !== "all" || search
                  ? "Aucune notification ne correspond à ces filtres."
                  : "Aucune notification pour le moment."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((n) => {
                const code = n.notificationType?.code ?? n.notification_type?.code;
                const style = getNotificationStyle(code);
                const Icon = style.icon;
                const link = getNotificationLink(n.target_type, n.target_id, isExtranet);

                return (
                  <li
                    key={n.id}
                    className={
                      "group flex items-start gap-3 px-4 py-3.5 border-l-4 transition-colors " +
                      style.border +
                      (n.is_read ? " border-l-transparent hover:bg-accent/40" : " bg-accent/30 hover:bg-accent/50")
                    }
                  >
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
                        {!n.is_read && (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                            Non lu
                          </Badge>
                        )}
                      </div>

                      {n.body && (
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      )}

                      <p className="text-[10px] text-muted-foreground pt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {link && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer text-xs"
                          onClick={() => handleOpen(n)}
                          title="Ouvrir"
                        >
                          Ouvrir
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      {!n.is_read && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => handleMarkOne(n)}
                          disabled={markRead.isPending}
                          title="Marquer comme lu"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pagination (cohérente avec QuotesListPage) */}
      {!isLoading && lastPage > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>
            {total} notification{total > 1 ? "s" : ""} · page {data?.current_page ?? page} / {lastPage}
          </span>
          <div className="space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={page >= lastPage || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
