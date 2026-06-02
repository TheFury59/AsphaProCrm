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

const NAV_GROUPS = [
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
      { to: "/intervenants", label: "Intervenants", icon: UserCog },
      { to: "/missions", label: "Missions", icon: Briefcase },
      { to: "/prestations", label: "Prestations", icon: Package },
      { to: "/planning", label: "Planning", icon: Calendar },
      { to: "/carte", label: "Carte", icon: Map },
    ],
  },
  {
    label: "Opérations",
    items: [
      { to: "/telegestion", label: "Télégestion", icon: QrCode },
      { to: "/stock", label: "Stock", icon: Boxes },
      { to: "/tickets", label: "Tickets clients", icon: Ticket },
      { to: "/messagerie", label: "Messagerie", icon: MessageSquare },
      { to: "/flotte", label: "Flotte véhicule", icon: Car },
    ],
  },
  {
    label: "Ventes",
    items: [
      { to: "/devis", label: "Devis", icon: FileText },
      { to: "/factures", label: "Factures", icon: Receipt },
      { to: "/reglements", label: "Règlements", icon: Wallet },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/parametres", label: "Paramètres", icon: Settings },
      // /admin/users sera ajouté dynamiquement ci-dessous si super_admin
      { to: "/aide", label: "Aide", icon: HelpCircle },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === "super_admin");

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
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.to}>
                          <Icon />
                          <span>{item.label}</span>
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
