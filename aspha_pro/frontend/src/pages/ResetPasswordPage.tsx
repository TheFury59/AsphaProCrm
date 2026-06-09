import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    password: z.string().min(8, "8 caractères minimum"),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["password_confirmation"],
  });
type FormValues = z.infer<typeof schema>;

/**
 * Page « Choisir un nouveau mot de passe ».
 *
 * Lue depuis le lien envoyé par mail : `/reset-password?token=X&email=Y`.
 *
 * - Token + email passés en query string
 * - Backend valide tout via `Password::reset` (token + email + expiry)
 * - Sur succès : tous les Personal Access Tokens existants sont révoqués
 *   (mobile + autres devices), le user doit re-login
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  // Lien incomplet : on renvoie vers /forgot-password
  if (!token || !email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await api.post("/reset-password", {
        token,
        email,
        password: values.password,
        password_confirmation: values.password_confirmation,
      });
      navigate("/login", {
        replace: true,
        state: { from: undefined, justResetPassword: true },
      });
    } catch (e) {
      setServerError(apiErrorMessage(e, "Réinitialisation impossible. Le lien est peut-être expiré."));
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
            Nouveau mot de passe.
          </h1>
          <p className="text-white/85 leading-relaxed">
            Choisissez un mot de passe robuste. Vos autres sessions (mobile, autres navigateurs)
            seront automatiquement déconnectées par sécurité.
          </p>
        </div>

        <div />
      </div>

      {/* Panneau droit : formulaire */}
      <div className="relative flex items-center justify-center p-6 lg:p-12 bg-grid-light">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-semibold tracking-tight">Choisir un nouveau mot de passe</h2>
            <p className="text-sm text-muted-foreground">
              Pour <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  placeholder="8 caractères minimum"
                  className="h-11 pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password_confirmation" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Confirmer le mot de passe
              </Label>
              <Input
                id="password_confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Retape le mot de passe"
                className="h-11"
                {...register("password_confirmation")}
              />
              {errors.password_confirmation && (
                <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-gradient-aspha hover:opacity-95 shadow-brand text-white font-medium transition-all group"
            >
              {isSubmitting ? (
                "Réinitialisation…"
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Choisir ce mot de passe
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            <Link to="/login" className="hover:underline">Retour à la connexion</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
