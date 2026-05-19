import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  KeyRound, Copy, Mail, RotateCcw, Trash2, Check,
  LogIn, AlertCircle, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useCreatePortalAccess, useResetPortalAccess, useSendPortalEmail, useRevokePortalAccess,
  type PortalAccessResult, type EntityType,
} from "@/hooks/use-portal-access";

/**
 * Section "Accès extranet" générique — pour client OU intervenant.
 *
 * 2 états :
 *  1. Aucun accès → bouton "Créer l'accès" (avec email à confirmer + option
 *     envoi email)
 *  2. Accès existant → email, dernière connexion, badge statut, actions :
 *     - Renvoyer email avec nouveau mot de passe
 *     - Réinitialiser le mot de passe (affichage clair)
 *     - Tester l'extranet (copie identifiant + ouvre /login dans nouvel onglet)
 *     - Révoquer l'accès
 *
 * Le mot de passe en clair n'est affiché qu'**une seule fois** dans un dialog
 * dédié après création/reset, avec bouton de copie. On ne stocke jamais le
 * clair côté serveur.
 */
type PortalUserShape = {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  last_login_at: string | null;
} | null | undefined;

type PortalAccessCardProps = {
  /** "client" → endpoints /clients/{id}/portal-access, "employee" → /employees/{id}/portal-access */
  type: EntityType;
  /** ID du client ou de l'intervenant */
  entityId: number;
  /** Le user lié s'il existe (depuis client.portal_user ou employee.user) */
  portalUser: PortalUserShape;
  /** Email pré-rempli proposé par défaut (primary_email pour client, vide pour intervenant) */
  defaultEmail?: string;
  /** Pour les copies UX. Default "client" → labels "client", "employee" → "intervenant" */
  labels?: {
    cardTitle: string;
    descriptionWithAccess: string;
    descriptionWithoutAccess: string;
    noAccessHint: string;
    revokeConfirm: string;
  };
};

const DEFAULT_LABELS: Record<EntityType, PortalAccessCardProps["labels"]> = {
  client: {
    cardTitle: "Accès extranet client",
    descriptionWithAccess: "Ce client peut se connecter à son espace portail pour consulter ses factures, prestations et envoyer des demandes.",
    descriptionWithoutAccess: "Crée un identifiant pour permettre à ce client d'accéder à son espace portail.",
    noAccessHint: "Aucun accès extranet pour ce client. Cliquez sur « Créer l'accès » pour générer un identifiant et un mot de passe.",
    revokeConfirm: "Révoquer l'accès extranet ? Le client ne pourra plus se connecter.",
  },
  employee: {
    cardTitle: "Accès extranet intervenant",
    descriptionWithAccess: "Cet intervenant peut se connecter à son espace personnel pour consulter son planning, sa messagerie et signaler des problèmes clients.",
    descriptionWithoutAccess: "Crée un identifiant pour permettre à cet intervenant d'accéder à son espace personnel.",
    noAccessHint: "Aucun accès extranet pour cet intervenant. Cliquez sur « Créer l'accès » pour générer un identifiant et un mot de passe.",
    revokeConfirm: "Révoquer l'accès extranet ? L'intervenant ne pourra plus se connecter.",
  },
};

export function PortalAccessCard({
  type, entityId, portalUser, defaultEmail = "", labels: customLabels,
}: PortalAccessCardProps) {
  const labels = customLabels ?? DEFAULT_LABELS[type]!;
  const hasAccess = !!portalUser;

  const createMut = useCreatePortalAccess(type, entityId);
  const resetMut = useResetPortalAccess(type, entityId);
  const sendMut = useSendPortalEmail(type, entityId);
  const revokeMut = useRevokePortalAccess(type, entityId);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [credentials, setCredentials] = useState<PortalAccessResult | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          {labels.cardTitle}
        </CardTitle>
        <CardDescription>
          {hasAccess ? labels.descriptionWithAccess : labels.descriptionWithoutAccess}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!hasAccess ? (
          // ============ Etat 1 : pas d'accès ============
          <>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-3 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-100">
                {labels.noAccessHint}
              </div>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
            >
              <KeyRound className="h-4 w-4 mr-1.5" />
              Créer l'accès extranet
            </Button>

            <CreateAccessDialog
              open={showCreateDialog}
              onClose={() => setShowCreateDialog(false)}
              defaultEmail={defaultEmail}
              onSuccess={(result) => {
                setShowCreateDialog(false);
                setCredentials(result);
              }}
              isPending={createMut.isPending}
              onSubmit={async (params) => {
                try {
                  return await createMut.mutateAsync(params);
                } catch (err: any) {
                  toast.error(err.response?.data?.message ?? "Création impossible");
                  throw err;
                }
              }}
            />
          </>
        ) : (
          // ============ Etat 2 : accès existant ============
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{portalUser.name}</div>
                <div className="text-xs text-muted-foreground truncate font-mono">{portalUser.email}</div>
              </div>
              <Badge
                className={
                  portalUser.status === "active"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }
              >
                {portalUser.status === "active" ? "Actif" : "Inactif"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/40 p-2">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                  Dernière connexion
                </div>
                <div>
                  {portalUser.last_login_at
                    ? formatDistanceToNow(new Date(portalUser.last_login_at), { addSuffix: true, locale: fr })
                    : <em className="text-muted-foreground">Jamais</em>}
                </div>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                  URL de connexion
                </div>
                <div className="font-mono text-[11px] truncate">{window.location.origin}/login</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={sendMut.isPending}
                onClick={async () => {
                  try {
                    const r = await sendMut.mutateAsync();
                    setCredentials(r);
                    if (r.email_sent) {
                      toast.success(`Email envoyé à ${type === "client" ? "l'entreprise" : "l'intervenant"}`);
                    } else {
                      toast.warning("Email NON envoyé (SMTP pas encore configuré) — utilise le mot de passe affiché");
                    }
                  } catch (err: any) {
                    toast.error(err.response?.data?.message ?? "Envoi impossible");
                  }
                }}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Envoyer email avec nouvelles infos
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={resetMut.isPending}
                onClick={async () => {
                  if (!confirm("Réinitialiser le mot de passe ? L'ancien sera invalidé.")) return;
                  try {
                    const r = await resetMut.mutateAsync({ send_email: false });
                    setCredentials(r);
                  } catch (err: any) {
                    toast.error(err.response?.data?.message ?? "Reset impossible");
                  }
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Réinitialiser mot de passe
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(portalUser.email);
                  toast.success("Identifiant copié");
                  window.open("/login", "_blank");
                }}
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Tester l'extranet
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:text-rose-700"
                disabled={revokeMut.isPending}
                onClick={async () => {
                  if (!confirm(labels.revokeConfirm)) return;
                  try {
                    await revokeMut.mutateAsync();
                    toast.success("Accès révoqué");
                  } catch (err: any) {
                    toast.error(err.response?.data?.message ?? "Révocation impossible");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Révoquer
              </Button>
            </div>
          </div>
        )}

        {/* Dialog affichage one-shot des identifiants (créé / reset / envoi email) */}
        <CredentialsDialog
          result={credentials}
          onClose={() => setCredentials(null)}
        />
      </CardContent>
    </Card>
  );
}

// =========================================================================
// Dialog : Création de l'accès — choix de l'email + option envoi
// =========================================================================

function CreateAccessDialog({
  open, onClose, defaultEmail, onSubmit, onSuccess, isPending,
}: {
  open: boolean;
  onClose: () => void;
  defaultEmail: string;
  onSubmit: (params: { email?: string; send_email?: boolean }) => Promise<PortalAccessResult>;
  onSuccess: (r: PortalAccessResult) => void;
  isPending: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [sendEmail, setSendEmail] = useState(true);

  // Resynchroniser l'email si le client change pendant que le dialog est fermé
  // (le primaryEmail vient des props parent)
  if (open && !email && defaultEmail) {
    setEmail(defaultEmail);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await onSubmit({
        email: email || undefined,
        send_email: sendEmail,
      });
      onSuccess(result);
    } catch {
      // erreur affichée en toast par le parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Créer l'accès extranet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Email du client *</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@exemple.fr"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Servira d'identifiant de connexion. Doit être unique dans le système.
              </p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Envoyer un email au client</span>
                <span className="block text-muted-foreground text-[11px]">
                  Si non coché, vous devrez communiquer le mot de passe manuellement.
                </span>
              </span>
            </label>

            <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2.5">
              ℹ️ Le mot de passe sera <strong>généré automatiquement</strong> et affiché une seule fois
              après création. Pensez à le copier ou l'envoyer par email.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!email || isPending}>
              {isPending ? "Création…" : "Créer l'accès"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// Dialog : Affichage one-shot des identifiants (après create/reset/email)
// =========================================================================

function CredentialsDialog({
  result, onClose,
}: {
  result: PortalAccessResult | null;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (!result) return null;

  return (
    <Dialog open={!!result} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:!max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Identifiants générés
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Statut email */}
          <div
            className={
              "rounded-md p-2.5 text-xs flex items-start gap-2 " +
              (result.email_sent
                ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100")
            }
          >
            {result.email_sent ? <Check className="h-3.5 w-3.5 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 mt-0.5" />}
            <span>
              {result.email_sent
                ? <>Email envoyé à <strong>{result.user.email}</strong>.</>
                : <>Email <strong>non envoyé</strong> (SMTP pas encore configuré). Copiez les identifiants manuellement.</>}
            </span>
          </div>

          {result.note && (
            <div className="text-[11px] text-muted-foreground italic">{result.note}</div>
          )}

          {/* Email */}
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Identifiant (email)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={result.user.email} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => copy("email", result.user.email)}
              >
                {copiedField === "email" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mot de passe (affiché une seule fois)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={result.password}
                readOnly
                className="font-mono text-base tracking-wider font-semibold"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => copy("password", result.password)}
              >
                {copiedField === "password" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              ⚠️ Ce mot de passe ne sera <strong>plus jamais affiché</strong>. Copiez-le maintenant ou utilisez
              « Réinitialiser » pour en générer un nouveau.
            </p>
          </div>

          <Button
            type="button"
            className="w-full mt-2"
            onClick={() => {
              navigator.clipboard.writeText(`Identifiant : ${result.user.email}\nMot de passe : ${result.password}\nURL : ${window.location.origin}/login`);
              toast.success("Identifiants complets copiés");
            }}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copier tout (identifiant + mot de passe + URL)
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>J'ai noté</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
