import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";
import { useUpdateMe } from "@/hooks/use-users";
import { apiErrorMessage } from "@/lib/api";

/**
 * Tâche A2 — page de changement de mot de passe forcé.
 *
 * Affichée quand `user.must_change_password` est vrai : un compte créé par
 * un admin (mot de passe temporaire) doit définir son propre mot de passe
 * avant d'accéder au reste de l'application.
 *
 * Réutilise l'endpoint existant PATCH /me (useUpdateMe) — le backend remet
 * `must_change_password` à false quand le changement réussit. Au succès on
 * redirige vers `/` : RoleRouter route ensuite vers l'espace adéquat.
 *
 * La route `/change-password` reste accessible même flag actif (cf.
 * ProtectedRoute) → pas de boucle de redirection.
 */
export function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const updateMe = useUpdateMe();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Renseigne ton mot de passe actuel et le nouveau");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit faire au moins 8 caractères");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent du mot de passe actuel");
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
      toast.success("Mot de passe modifié — bienvenue !");
      // useUpdateMe re-sync le store (fetchMe) : must_change_password retombe
      // à false. On renvoie sur l'accueil, RoleRouter route ensuite.
      navigate("/", { replace: true });
    } catch (err) {
      console.error("ChangePasswordPage: échec du changement de mot de passe", err);
      toast.error(apiErrorMessage(err, "Changement de mot de passe impossible"));
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Changement de mot de passe requis
          </CardTitle>
          <CardDescription>
            {user?.name ? `Bonjour ${user.name}. ` : ""}
            Ton compte a été créé avec un mot de passe temporaire. Définis ton
            propre mot de passe pour continuer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label className="text-xs flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Mot de passe actuel (temporaire) *
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
            <Button type="submit" disabled={updateMe.isPending} className="w-full gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {updateMe.isPending ? "Modification…" : "Définir mon mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
