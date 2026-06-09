import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Users, Search, ShieldCheck, ShieldOff, ShieldAlert,
  Crown, Loader2, Power, PowerOff, Plus, Copy, Check, AlertCircle,
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EntityAvatar } from "@/components/EntityAvatar";
import { useAuthStore } from "@/stores/auth";
import {
  useAdminUsers, useAvailableRoles, useSetUserRole, useUpdateUserStatus,
  useCreateUser,
  type AdminUser, type CreateUserResult,
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
  const [createOpen, setCreateOpen] = useState(false);
  // Dialog one-shot d'affichage du password apres creation
  const [createdResult, setCreatedResult] = useState<CreateUserResult | null>(null);

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
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95">
                <Plus className="h-4 w-4 mr-1.5" /> Nouvel utilisateur
              </Button>
            </DialogTrigger>
            <CreateUserDialog
              onClose={() => setCreateOpen(false)}
              onCreated={(result) => {
                setCreateOpen(false);
                setCreatedResult(result);
              }}
            />
          </Dialog>
        }
      />

      {/* Note explicative sur le scope de la page */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-amber-900 dark:text-amber-100">
          <strong>Cette page liste uniquement les comptes de connexion existants.</strong>{" "}
          Les intervenants et clients qui n'ont pas encore d'accès au portail
          n'apparaissent pas ici. Pour leur créer un accès :
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
            <li><strong>Clients</strong> : fiche client → onglet Général → carte "Accès extranet" → bouton "Créer l'accès"</li>
            <li><strong>Intervenants</strong> : à venir, ou crée manuellement un compte ci-dessus avec le rôle "Intervenant"</li>
            <li><strong>Admins / Super-admins</strong> : clique "Nouvel utilisateur" en haut à droite</li>
          </ul>
        </div>
      </div>

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

      {/* Dialog one-shot d'affichage des identifiants apres creation */}
      {createdResult && (
        <CredentialsDialog
          result={createdResult}
          onClose={() => setCreatedResult(null)}
        />
      )}
    </div>
  );
}

// =========================================================================
// Dialog affichage one-shot des identifiants apres creation
// =========================================================================

function CredentialsDialog({
  result, onClose,
}: {
  result: CreateUserResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            Utilisateur créé
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-xs">
            <strong className="text-emerald-900 dark:text-emerald-100">{result.user.name}</strong>
            <div className="text-emerald-700 dark:text-emerald-300 mt-0.5">
              Rôle : <strong>{result.user.role}</strong>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Identifiant (email)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={result.user.email} readOnly className="font-mono text-sm" />
              <Button type="button" size="icon" variant="outline" onClick={() => copy("email", result.user.email)}>
                {copied === "email" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mot de passe {result.password_was_generated && "(généré automatiquement)"}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={result.password}
                readOnly
                className="font-mono text-base tracking-wider font-semibold"
              />
              <Button type="button" size="icon" variant="outline" onClick={() => copy("password", result.password)}>
                {copied === "password" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              ⚠ Ce mot de passe ne sera <strong>plus jamais affiché</strong>. Copie-le ou communique-le maintenant.
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() => {
              navigator.clipboard.writeText(
                `Identifiant : ${result.user.email}\nMot de passe : ${result.password}\nURL : ${window.location.origin}/login`,
              );
              toast.success("Identifiants complets copiés");
            }}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copier tout (id + password + URL)
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>J'ai noté</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <EntityAvatar src={user.avatar_url} name={user.name} variant="employee" size="sm" />
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

// =========================================================================
// Dialog "Nouvel utilisateur"
// =========================================================================

function CreateUserDialog({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (result: CreateUserResult) => void;
}) {
  const create = useCreateUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"super_admin" | "admin" | "intervenant" | "client">("admin");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password: password || undefined,
        role,
      });
      toast.success("Utilisateur créé");
      onCreated(result);
    } catch (err: any) {
      const data = err?.response?.data;
      const firstErr = data?.errors ? Object.values(data.errors).flat()[0] : null;
      toast.error((firstErr as string) ?? data?.message ?? "Création impossible");
    }
  };

  return (
    <DialogContent className="sm:!max-w-md">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Nouvel utilisateur
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div>
            <Label className="text-xs">Nom complet *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jean Dupont"
              required
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@aspha.local"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Servira d'identifiant de connexion.
            </p>
          </div>
          <div>
            <Label className="text-xs">Rôle *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">
                  <Crown className="h-3 w-3 inline mr-1.5" />
                  Super-administrateur
                </SelectItem>
                <SelectItem value="admin">
                  <ShieldCheck className="h-3 w-3 inline mr-1.5" />
                  Administrateur
                </SelectItem>
                <SelectItem value="intervenant">
                  <ShieldAlert className="h-3 w-3 inline mr-1.5" />
                  Intervenant
                </SelectItem>
                <SelectItem value="client">
                  <ShieldOff className="h-3 w-3 inline mr-1.5" />
                  Client
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mot de passe (optionnel)</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Laisser vide pour générer automatiquement"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Si vide, un mot de passe sera généré et affiché une seule fois.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!name.trim() || !email.trim() || create.isPending}>
            {create.isPending ? "Création…" : "Créer l'utilisateur"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

