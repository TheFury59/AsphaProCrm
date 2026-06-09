import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Building2, ShieldCheck, Sparkles, Zap, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(4, "Mot de passe trop court"),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Login page Aspha Pro — design split-screen :
 *  - Gauche (lg+) : panneau marqué avec dégradé brand + 3 features
 *  - Droite : carte glass avec formulaire centré
 */
export function LoginPage() {
  const { login, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password, values.remember);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (e) {
      setServerError(apiErrorMessage(e, "Connexion impossible"));
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Panneau gauche : marque + features */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-aspha text-white">
        {/* Décor : cercles flous */}
        <div aria-hidden className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-sky-300/30 blur-3xl" />
        <div aria-hidden className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.06%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />

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
            L'ERP pensé pour les <span className="underline decoration-white/50 decoration-2 underline-offset-4">entreprises de services</span>.
          </h1>
          <p className="text-white/85 leading-relaxed">
            Planning, télégestion, facturation Factur-X, paie via Silae, portail client.
            Une seule plateforme, conforme et fluide.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-3">
          <Feature icon={Zap}>Planning intelligent avec matching auto intervenant</Feature>
          <Feature icon={ShieldCheck}>Conforme Factur-X 1er sept · RGPD · sauvegarde quotidienne</Feature>
          <Feature icon={Sparkles}>Télégestion QR code, signature électronique, géolocalisation</Feature>
        </div>
      </div>

      {/* Panneau droit : formulaire */}
      <div className="relative flex items-center justify-center p-6 lg:p-12 bg-grid-light">
        {/* Logo mobile (visible quand panneau gauche caché) */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-aspha text-white shadow-brand">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-semibold">Aspha Pro</span>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-semibold tracking-tight">Bienvenue</h2>
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour accéder à votre espace.
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
                className="h-11 transition-all focus-visible:ring-primary focus-visible:ring-2"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Mot de passe
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
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

            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("remember")}
                className="h-4 w-4 rounded border border-input accent-primary"
              />
              Se souvenir de moi
            </label>

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
                "Connexion…"
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            v0.1.0 · Aspha Pro
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm text-white/90 leading-relaxed pt-1.5">{children}</p>
    </div>
  );
}
