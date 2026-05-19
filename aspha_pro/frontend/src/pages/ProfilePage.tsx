import { useState } from "react";
import { User, Mail, KeyRound, ShieldCheck, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/EntityAvatar";
import { useAuthStore } from "@/stores/auth";
import { useUpdateMe } from "@/hooks/use-users";

/**
 * Page "Mon profil" — accessible depuis le dropdown topbar pour TOUS les
 * utilisateurs connectés (admin, super_admin, intervenant, client).
 *
 * 2 cards :
 *  - Identité : nom + email (modifiables)
 *  - Sécurité : changement de mot de passe (requiert l'ancien)
 *
 * Le rôle est affiché en lecture seule (read-only) — seul un super_admin
 * peut changer le rôle via /admin/users.
 */

const ROLE_LABELS: Record<string, { label: string; bg: string }> = {
  super_admin: { label: "Super-administrateur", bg: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  admin: { label: "Administrateur", bg: "bg-primary/10 text-primary" },
  intervenant: { label: "Intervenant", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  client: { label: "Client", bg: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
};

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateMe = useUpdateMe();

  // Form d'identité (nom + email)
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const identityDirty = name !== user?.name || email !== user?.email;

  // Form sécurité (changement de mot de passe)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (!user) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  const role = user.role ?? "admin";
  const roleMeta = ROLE_LABELS[role] ?? { label: role, bg: "bg-muted" };

  const submitIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityDirty) return;
    try {
      await updateMe.mutateAsync({ name, email });
      toast.success("Profil mis à jour");
    } catch (err: any) {
      const data = err?.response?.data;
      const firstErr = data?.errors ? Object.values(data.errors).flat()[0] : null;
      toast.error((firstErr as string) ?? data?.message ?? "Mise à jour impossible");
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Renseigne ton mot de passe actuel et le nouveau");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit faire au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas au nouveau mot de passe");
      return;
    }
    try {
      await updateMe.mutateAsync({
        password: newPassword,
        current_password: currentPassword,
      });
      toast.success("Mot de passe modifié");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const data = err?.response?.data;
      const firstErr = data?.errors ? Object.values(data.errors).flat()[0] : null;
      toast.error((firstErr as string) ?? data?.message ?? "Changement impossible");
    }
  };

  return (
    <div>
      <PageHeader
        title="Mon profil"
        description="Modifie ton identité, ton email et ton mot de passe."
      />

      {/* Header avec avatar + rôle */}
      <Card className="mb-4">
        <CardContent className="pt-6 flex items-center gap-4">
          <EntityAvatar name={user.name} variant="employee" size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold">{user.name}</div>
            <div className="text-sm text-muted-foreground font-mono">{user.email}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge className={roleMeta.bg}>
                <ShieldCheck className="h-3 w-3 mr-1" />
                {roleMeta.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                ID #{user.id}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* IDENTITÉ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Identité
            </CardTitle>
            <CardDescription>Modifie ton nom et ton adresse email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitIdentity} className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs">Nom complet</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Sert d'identifiant de connexion.
                </p>
              </div>
              <Button
                type="submit"
                disabled={!identityDirty || updateMe.isPending}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {updateMe.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* SECURITE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Sécurité
            </CardTitle>
            <CardDescription>Change ton mot de passe.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitPassword} className="space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Mot de passe actuel *
                </Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label className="text-xs">Nouveau mot de passe *</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Min. 8 caractères"
                />
              </div>
              <div>
                <Label className="text-xs">Confirmer le nouveau *</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Retape pour confirmer"
                />
              </div>
              <Button
                type="submit"
                disabled={updateMe.isPending}
                className="gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {updateMe.isPending ? "Modification…" : "Changer le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Note rôle */}
      <Card className="mt-4 bg-muted/30">
        <CardContent className="pt-4 flex items-start gap-2.5 text-xs">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Ton rôle est <strong>{roleMeta.label}</strong>.</div>
            <div className="text-muted-foreground mt-0.5">
              Pour changer de rôle, contacte un super-administrateur.
              {role !== "super_admin" && " Le rôle détermine les accès et fonctionnalités disponibles."}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
