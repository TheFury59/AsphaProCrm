import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Users, Search, ShieldCheck, ShieldOff, ShieldAlert,
  Crown, Loader2, Power, PowerOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EntityAvatar } from "@/components/EntityAvatar";
import { useAuthStore } from "@/stores/auth";
import {
  useAdminUsers, useAvailableRoles, useSetUserRole, useUpdateUserStatus,
  type AdminUser,
} from "@/hooks/use-users";

/**
 * Page admin de gestion des utilisateurs — réservée au super_admin.
 *
 * Permet à un super_admin de :
 *  - Voir tous les utilisateurs (admin + intervenants + clients + super_admins)
 *  - Changer le rôle d'un utilisateur via select inline
 *  - Activer/désactiver un compte (inactive = ne peut plus se connecter)
 *
 * Garde-fous backend :
 *  - Un super_admin ne peut pas se rétrograder lui-même
 *  - Un super_admin ne peut pas se désactiver lui-même
 *
 * Route : /admin/users
 */

const ROLE_META: Record<string, { label: string; bg: string; icon: typeof ShieldCheck }> = {
  super_admin: {
    label: "Super-admin",
    bg: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200",
    icon: Crown,
  },
  admin: {
    label: "Admin",
    bg: "bg-primary/10 text-primary border-primary/30",
    icon: ShieldCheck,
  },
  intervenant: {
    label: "Intervenant",
    bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    icon: ShieldAlert,
  },
  client: {
    label: "Client",
    bg: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200",
    icon: ShieldOff,
  },
};

export function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data, isLoading } = useAdminUsers({
    search,
    role: roleFilter === "all" ? undefined : roleFilter,
  });
  const { data: availableRoles = [] } = useAvailableRoles();

  // Garde-fou frontend : non-super_admin → redirige (le backend bloque aussi via 403)
  if (currentUser && currentUser.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  const users = data?.users ?? [];

  return (
    <div>
      <PageHeader
        title="Gestion des utilisateurs"
        description="Affecter les rôles et activer/désactiver les comptes. Réservé super-administrateur."
      />

      {/* Card explicative des rôles */}
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        {availableRoles.map((r) => {
          const meta = ROLE_META[r.name];
          const Icon = meta?.icon ?? ShieldCheck;
          return (
            <Card key={r.name} className={`border-2 ${meta?.bg ?? ""}`}>
              <CardContent className="pt-4 flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{r.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5 leading-tight">{r.description}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="mb-5 px-4 py-3 rounded-2xl bg-card shadow-soft flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nom, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-0 bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="super_admin">Super-admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="intervenant">Intervenant</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md ml-auto">
          <span className="font-medium text-foreground">{data?.meta.total ?? 0}</span> utilisateur{(data?.meta.total ?? 0) > 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Utilisateur</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Email</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Rôle</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Statut</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Dernière connexion</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={`s-${i}`}>
                {[...Array(6)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <div className="text-sm text-muted-foreground">Aucun utilisateur.</div>
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <UserRow key={u.id} user={u} isCurrentUser={u.id === currentUser?.id} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// =========================================================================
// User row (line item with inline role select)
// =========================================================================

function UserRow({ user, isCurrentUser }: { user: AdminUser; isCurrentUser: boolean }) {
  const setRole = useSetUserRole();
  const updateStatus = useUpdateUserStatus();
  const meta = user.role ? ROLE_META[user.role] : null;

  const handleRoleChange = async (newRole: string) => {
    if (newRole === user.role) return;
    try {
      await setRole.mutateAsync({ userId: user.id, role: newRole });
      toast.success(`Rôle mis à jour : ${newRole}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Modification impossible");
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    const verb = newStatus === "inactive" ? "Désactiver" : "Activer";
    if (!confirm(`${verb} le compte de ${user.name} ?`)) return;
    try {
      await updateStatus.mutateAsync({ userId: user.id, status: newStatus });
      toast.success(`Compte ${newStatus === "active" ? "activé" : "désactivé"}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Modification impossible");
    }
  };

  return (
    <TableRow className={isCurrentUser ? "bg-primary/5" : ""}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <EntityAvatar name={user.name} variant="employee" size="sm" />
          <div>
            <div className="text-sm font-medium">{user.name}</div>
            {isCurrentUser && (
              <div className="text-[10px] text-primary font-medium">(c'est toi)</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm font-mono text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <Select
          value={user.role ?? ""}
          onValueChange={handleRoleChange}
          disabled={setRole.isPending}
        >
          <SelectTrigger className={`w-[160px] h-8 text-xs ${meta?.bg ?? ""}`}>
            <SelectValue placeholder="Aucun rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="super_admin">Super-admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="intervenant">Intervenant</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Badge
          variant={user.status === "active" ? "default" : "secondary"}
          className={user.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}
        >
          {user.status === "active" ? "Actif" : "Inactif"}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.last_login_at
          ? formatDistanceToNow(new Date(user.last_login_at), { locale: fr, addSuffix: true })
          : <em>Jamais</em>}
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          disabled={isCurrentUser || updateStatus.isPending}
          onClick={handleToggleStatus}
          className={user.status === "active" ? "text-rose-600 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-700"}
          title={isCurrentUser ? "Tu ne peux pas désactiver ton propre compte" : ""}
        >
          {updateStatus.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : user.status === "active"
              ? <PowerOff className="h-3.5 w-3.5" />
              : <Power className="h-3.5 w-3.5" />}
          <span className="ml-1 text-xs">
            {user.status === "active" ? "Désactiver" : "Activer"}
          </span>
        </Button>
      </TableCell>
    </TableRow>
  );
}
