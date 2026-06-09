import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Building2, ArrowRight, ArrowLeft, MailCheck } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Email invalide"),
});
type FormValues = z.infer<typeof schema>;

/**
 * Page « Mot de passe oublié ».
 * - L'utilisateur saisit son email
 * - POST /api/v1/forgot-password
 * - Si l'email existe en base, un mail est envoyé avec un lien
 *   /reset-password?token=X&email=Y (cf. PasswordResetController)
 * - Pour éviter l'énumération d'emails, le backend renvoie un 200 OK
 *   même quand l'email n'existe pas → on affiche dans tous les cas le
 *   même écran de confirmation.
 */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await api.post("/forgot-password", { email: values.email });
      setSent(true);
    } catch (e) {
      setServerError(apiErrorMessage(e, "Envoi impossible"));
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Panneau gauche : marque */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-aspha text-white">
        <div aria-hidden className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-sky-300/30 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 shadow-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight">Aspha Pro</div>
              <div className="text-xs text-white/70">ERP de gestion · Entreprises de services</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Récupérez l'accès à votre compte.
          </h1>
          <p className="text-white/85 leading-relaxed">
            Un email vous sera envoyé avec un lien de réinitialisation valable {""}
            <strong>60 minutes</strong>.
          </p>
        </div>

        <div />
      </div>

      {/* Panneau droit : formulaire */}
      <div className="relative flex items-center justify-center p-6 lg:p-12 bg-grid-light">
        <div className="w-full max-w-md space-y-6">
          {sent ? (
            <div className="space-y-6 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheck className="h-7 w-7" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight">Vérifiez votre boîte mail</h2>
                <p className="text-sm text-muted-foreground">
                  Si l'adresse <strong>{getValues("email")}</strong> est associée à un compte
                  Aspha Pro, vous allez recevoir un email avec un lien pour choisir un nouveau
                  mot de passe.
                </p>
                <p className="text-sm text-muted-foreground">
                  Pensez à vérifier votre dossier <em>spam</em> si vous ne le trouvez pas.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-3xl font-semibold tracking-tight">Mot de passe oublié</h2>
                <p className="text-sm text-muted-foreground">
                  Entrez l'email associé à votre compte, on vous envoie un lien pour le réinitialiser.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="vous@aspha.fr"
                    className="h-11"
                    {...register("email")}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>

                {serverError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                    {serverError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-gradient-aspha hover:opacity-95 shadow-brand text-white font-medium transition-all group"
                >
                  {isSubmitting ? (
                    "Envoi…"
                  ) : (
                    <>
                      Envoyer le lien
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-center lg:text-left">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
