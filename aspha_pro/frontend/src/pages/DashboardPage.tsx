import { Link } from "react-router-dom";
import {
  Users, UserCog, Calendar, FileText, Receipt, ArrowUpRight,
  QrCode, Boxes, Sparkles, Map, MessageSquare, Car, LifeBuoy,
  Activity, Zap,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useClients } from "@/hooks/use-clients";
import { useEmployees } from "@/hooks/use-employees";
import { useInterventions } from "@/hooks/use-phase3";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Dashboard Aspha — pleine largeur, blocs lisibles, 3D doux.
 */
export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: clientsData } = useClients({ per_page: 1 });
  const { data: employeesData } = useEmployees({ per_page: 1 });
  const today = fmt(new Date());
  const weekFromNow = fmt(new Date(Date.now() + 7 * 86400000));
  const interventions = useInterventions({ from: today, to: weekFromNow });

  const clientsCount = (clientsData as any)?.meta?.total ?? clientsData?.data?.length ?? 0;
  const employeesCount = (employeesData as any)?.meta?.total ?? employeesData?.data?.length ?? 0;
  const intervCount = interventions.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* === HERO PLEINE LARGEUR === */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-aspha text-white shadow-brand-lg">
        <div aria-hidden className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-sky-300/30 blur-3xl" />
        <div aria-hidden className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`
        }} />

        <div className="relative z-10 p-8 lg:p-12 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-4">
              <Activity className="h-3 w-3" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Tableau de bord</span>
            </div>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-semibold tracking-tight leading-tight">
              Bonjour {user?.name?.split(" ")[0] ?? ""} 👋
            </h1>
            <p className="text-white/85 mt-3 text-base lg:text-lg leading-relaxed">
              Voici un aperçu de votre activité. {intervCount} intervention{intervCount > 1 ? "s" : ""} planifiée{intervCount > 1 ? "s" : ""} cette semaine.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/planning">
              <button className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white font-medium transition-all hover:scale-[1.02]">
                <Calendar className="h-4 w-4" />
                Voir le planning
              </button>
            </Link>
            <Link to="/clients">
              <button className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-foreground hover:bg-white/95 font-medium transition-all hover:scale-[1.02] shadow-lg shadow-black/10">
                <Users className="h-4 w-4" />
                Mes clients
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* === KPI cards pleine largeur === */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Clients actifs"
          value={String(clientsCount)}
          icon={Users}
          to="/clients"
          accent="primary"
          trend="+12% ce mois"
        />
        <KpiCard
          label="Intervenants"
          value={String(employeesCount)}
          icon={UserCog}
          to="/intervenants"
          accent="sky"
          trend="3 nouveaux"
        />
        <KpiCard
          label="Interventions 7 jours"
          value={String(intervCount)}
          icon={Calendar}
          to="/planning"
          accent="orange"
          trend="Cette semaine"
        />
        <KpiCard
          label="Factures ouvertes"
          value="—"
          icon={Receipt}
          to="/factures"
          accent="violet"
          trend="En attente"
        />
      </div>

      {/* === Quick links + statut système === */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Modules */}
        <div className="lg:col-span-2 bg-card rounded-2xl shadow-soft p-6 lg:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 tracking-tight">
                <Sparkles className="h-5 w-5 text-primary" />
                Modules métier
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Accès rapide aux fonctionnalités courantes.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <QuickLink to="/planning" icon={Calendar} label="Planning" desc="Rendez-vous" />
            <QuickLink to="/carte" icon={Map} label="Carte" desc="Géolocalisation" />
            <QuickLink to="/telegestion" icon={QrCode} label="Télégestion" desc="QR + badge" />
            <QuickLink to="/stock" icon={Boxes} label="Stock" desc="Inventaire" />
            <QuickLink to="/portail-client" icon={LifeBuoy} label="Portail" desc="Demandes" />
            <QuickLink to="/messagerie" icon={MessageSquare} label="Messages" desc="Conversations" />
            <QuickLink to="/flotte" icon={Car} label="Flotte" desc="Véhicules" />
            <QuickLink to="/devis" icon={FileText} label="Devis" desc="Propositions" />
          </div>
        </div>

        {/* Statut système */}
        <div className="bg-card rounded-2xl shadow-soft p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 tracking-tight">
              <Zap className="h-5 w-5 text-primary" />
              Système
            </h2>
            <p className="text-sm text-muted-foreground mt-1">État des intégrations.</p>
          </div>
          <ul className="space-y-3">
            <StatusRow label="API V1" ok />
            <StatusRow label="Authentification" ok />
            <StatusRow label="Géocodage BAN" ok />
            <StatusRow label="Pennylane" ok={false} note="mock" />
            <StatusRow label="Google Maps" ok={false} note="non config" />
            <StatusRow label="Notifications FCM" ok={false} note="non config" />
            <StatusRow label="Silae" ok={false} note="non config" />
          </ul>
        </div>
      </div>
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  primary: "from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/10",
  sky: "from-sky-50 to-sky-100/40 dark:from-sky-950/40 dark:to-sky-900/10",
  orange: "from-orange-50 to-amber-100/40 dark:from-orange-950/40 dark:to-amber-900/10",
  violet: "from-violet-50 to-fuchsia-100/40 dark:from-violet-950/40 dark:to-fuchsia-900/10",
};
const ACCENT_ICON: Record<string, string> = {
  primary: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

function KpiCard({ label, value, icon: Icon, to, accent, trend }: {
  label: string; value: string; icon: any; to: string; accent: keyof typeof ACCENT_BG; trend: string;
}) {
  return (
    <Link to={to} className="group block cursor-pointer">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${ACCENT_BG[accent]} shadow-soft shadow-soft-hover p-6 h-full`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${ACCENT_ICON[accent]} ring-1 ring-inset ring-white/40 dark:ring-white/10`}>
            <Icon className="h-5 w-5" />
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          <div className="text-4xl font-semibold tracking-tight leading-none">{value}</div>
          <div className="text-xs text-muted-foreground pt-1">{trend}</div>
        </div>
      </div>
    </Link>
  );
}

function QuickLink({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-2 rounded-xl bg-muted/40 hover:bg-card border border-transparent hover:border-primary/30 hover:shadow-md transition-all p-4 group cursor-pointer"
    >
      <div className="h-9 w-9 rounded-lg bg-card group-hover:bg-primary/10 transition-colors flex items-center justify-center shadow-sm">
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div>
        <div className="text-sm font-medium leading-tight">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </Link>
  );
}

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <li className="flex items-center justify-between py-1">
      <span className="flex items-center gap-2.5 text-sm">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-orange-400"} ${ok ? "shadow-[0_0_8px_oklch(0.74_0.22_158_/_0.6)]" : ""}`} />
        <span className="font-medium">{label}</span>
      </span>
      {ok ? (
        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
          Actif
        </span>
      ) : (
        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{note ?? "Inactif"}</span>
      )}
    </li>
  );
}
