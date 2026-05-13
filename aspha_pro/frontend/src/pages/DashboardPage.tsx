import { Link } from "react-router-dom";
import {
  Users, UserCog, Calendar, FileText, Receipt, TrendingUp, ArrowUpRight,
  QrCode, Boxes, Sparkles, Map, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { useClients } from "@/hooks/use-clients";
import { useEmployees } from "@/hooks/use-employees";
import { useInterventions } from "@/hooks/use-phase3";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Dashboard Aspha — hero gradient + KPI cards + raccourcis modules.
 */
export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: clientsData } = useClients({ per_page: 1 });
  const { data: employeesData } = useEmployees({ per_page: 1 });
  const today = fmt(new Date());
  const weekFromNow = fmt(new Date(Date.now() + 7 * 86400000));
  const interventions = useInterventions({ from: today, to: weekFromNow });

  const clientsCount = (clientsData as any)?.meta?.total ?? clientsData?.data?.length ?? "—";
  const employeesCount = (employeesData as any)?.meta?.total ?? employeesData?.data?.length ?? "—";
  const intervCount = interventions.data?.length ?? "—";

  return (
    <div className="space-y-6">
      {/* === HERO === */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-aspha text-white p-6 md:p-8">
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Bonjour {user?.name?.split(" ")[0] ?? ""} 👋
            </h1>
            <p className="text-white/85 mt-1 text-sm md:text-base">
              Voici un aperçu de votre activité Aspha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/planning">
              <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm">
                <Calendar className="h-4 w-4 mr-2" />
                Voir le planning
              </Button>
            </Link>
            <Link to="/clients">
              <Button variant="secondary" className="bg-white text-foreground hover:bg-white/90">
                <Users className="h-4 w-4 mr-2" />
                Mes clients
                <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* === KPI cards === */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
          label="Interventions 7j"
          value={String(intervCount)}
          icon={Calendar}
          to="/planning"
          accent="orange"
          trend="—"
        />
        <KpiCard
          label="Factures ouvertes"
          value="—"
          icon={Receipt}
          to="/factures"
          accent="violet"
          trend="—"
        />
      </div>

      {/* === Quick links === */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Modules métier
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Accès rapide aux fonctionnalités courantes.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <QuickLink to="/planning" icon={Calendar} label="Planning" />
              <QuickLink to="/carte" icon={Map} label="Carte" />
              <QuickLink to="/telegestion" icon={QrCode} label="Télégestion" />
              <QuickLink to="/stock" icon={Boxes} label="Stock" />
              <QuickLink to="/devis" icon={FileText} label="Devis" />
              <QuickLink to="/factures" icon={Receipt} label="Factures" />
              <QuickLink to="/messagerie" icon={MessageSquare} label="Messagerie" />
              <QuickLink to="/aide" icon={Sparkles} label="Aide" />
            </div>
          </CardContent>
        </Card>

        {/* Statut système */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Système
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">État des intégrations.</p>
            </div>
            <ul className="space-y-2 text-sm">
              <StatusRow label="API V1" ok />
              <StatusRow label="Authentification" ok />
              <StatusRow label="Pennylane" ok={false} note="mock" />
              <StatusRow label="Google Maps" ok={false} note="non config" />
              <StatusRow label="Notifications FCM" ok={false} note="non config" />
              <StatusRow label="Silae" ok={false} note="non config" />
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  primary: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20",
  sky: "bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/40 dark:to-sky-900/20",
  orange: "bg-gradient-to-br from-orange-50 to-amber-100/50 dark:from-orange-950/40 dark:to-amber-900/20",
  violet: "bg-gradient-to-br from-violet-50 to-fuchsia-100/50 dark:from-violet-950/40 dark:to-fuchsia-900/20",
};
const ACCENT_ICON: Record<string, string> = {
  primary: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

function KpiCard({ label, value, icon: Icon, to, accent, trend }: {
  label: string; value: string; icon: any; to: string; accent: keyof typeof ACCENT_BG; trend: string;
}) {
  return (
    <Link to={to} className="group block">
      <Card className={`overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${ACCENT_BG[accent]}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${ACCENT_ICON[accent]}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight">{value}</div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-[10px] text-muted-foreground">{trend}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border bg-card hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm transition-all px-3 py-2.5 group cursor-pointer"
    >
      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <span className="text-sm font-medium flex-1">{label}</span>
      <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500 animate-pulse" : "bg-orange-400"}`} />
        {label}
      </span>
      {ok ? (
        <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
          Actif
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px]">{note ?? "Inactif"}</Badge>
      )}
    </li>
  );
}
