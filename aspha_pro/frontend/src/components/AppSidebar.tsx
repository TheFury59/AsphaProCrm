import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Package,
  Briefcase,
  Calendar,
  FileText,
  Receipt,
  Settings,
  Building2,
  Wallet,
  Map,
  QrCode,
  Boxes,
  MessageSquare,
  Car,
  HelpCircle,
  Ticket,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useUnreadCountByModule } from "@/hooks/use-operations";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Mapping `module backend → tab sidebar`.
 * Les modules backend sont définis dans le NotificationType (champ `module`) :
 *   planning / portal / messaging / sales / telemanagement / stock /
 *   documents / missions / rh / matching
 *
 * Une tab peut couvrir plusieurs modules (ex. Intervenants couvre `rh` et
 * `documents`). Une notif `sales` apparaît sur Devis ET Factures — le user
 * clique celui qui l'intéresse.
 */
type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Modules dont les compteurs s'agrègent pour cette tab. */
  modules?: string[];
  /** Si true, affiche le TOTAL toutes notifs confondues (pour /notifications). */
  totalBadge?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Pilotage",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
    ],
  },
  {
    label: "Métier",
    items: [
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/intervenants", label: "Intervenants", icon: UserCog, modules: ["rh", "documents"] },
      { to: "/missions", label: "Missions", icon: Briefcase, modules: ["missions"] },
      { to: "/prestations", label: "Prestations", icon: Package },
      { to: "/planning", label: "Planning", icon: Calendar, modules: ["planning", "matching"] },
      { to: "/carte", label: "Carte", icon: Map },
    ],
  },
  {
    label: "Opérations",
    items: [
      { to: "/telegestion", label: "Télégestion", icon: QrCode, modules: ["telemanagement"] },
      { to: "/stock", label: "Stock", icon: Boxes, modules: ["stock"] },
      { to: "/tickets", label: "Tickets clients", icon: Ticket, modules: ["portal"] },
      { to: "/messagerie", label: "Messagerie", icon: MessageSquare, modules: ["messaging"] },
      { to: "/flotte", label: "Flotte véhicule", icon: Car },
    ],
  },
  {
    label: "Ventes",
    items: [
      { to: "/devis", label: "Devis", icon: FileText, modules: ["sales"] },
      { to: "/factures", label: "Factures", icon: Receipt, modules: ["sales"] },
      { to: "/reglements", label: "Règlements", icon: Wallet },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell, totalBadge: true },
      { to: "/parametres", label: "Paramètres", icon: Settings },
      // /admin/users sera ajouté dynamiquement ci-dessous si super_admin
      { to: "/aide", label: "Aide", icon: HelpCircle },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === "super_admin");
  const { data: countsByModule } = useUnreadCountByModule();

  // On clone les groupes pour ajouter l'entrée "Utilisateurs" dans
  // Administration uniquement si l'utilisateur est super_admin.
  // (cf. règle métier 2026-05-18 : gestion des rôles réservée super_admin)
  // "Utilisateurs" est inséré juste après "Paramètres" (recherché par `to`
  // pour rester robuste si l'ordre des items évolue).
  const navGroups = NAV_GROUPS.map((g) => {
    if (g.label !== "Administration" || !isSuperAdmin) return g;
    const items = [...g.items];
    const settingsIdx = items.findIndex((it) => it.to === "/parametres");
    const at = settingsIdx >= 0 ? settingsIdx + 1 : items.length;
    items.splice(at, 0, { to: "/admin/users", label: "Utilisateurs", icon: ShieldCheck });
    return { ...g, items };
  });

  // Total toutes notifs confondues (pour l'onglet /notifications).
  const totalCount = Object.values(countsByModule ?? {}).reduce((a, b) => a + b, 0);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border py-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-aspha text-white shadow-brand shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-sm leading-tight">
            <span className="font-semibold tracking-tight">Aspha <span className="text-gradient-aspha">Pro</span></span>
            <span className="text-[10px] text-muted-foreground tracking-wide">ERP entreprises de services</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                  // Calcul du badge : somme des compteurs des modules associés,
                  // OU total global si totalBadge=true.
                  const count = item.totalBadge
                    ? totalCount
                    : (item.modules ?? []).reduce((acc, mod) => acc + (countsByModule?.[mod] ?? 0), 0);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.to}>
                          <Icon />
                          <span className="flex-1">{item.label}</span>
                          {count > 0 ? <SidebarBadge count={count} /> : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tracking-wide">v0.1.0</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            En ligne
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Petit badge rouge avec compteur affiché à droite d'un item de sidebar.
 * Limite à 99+ pour éviter les badges trop larges.
 */
function SidebarBadge({ count }: { count: number }) {
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm"
      aria-label={`${count} notification${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`}
    >
      {display}
    </span>
  );
}
