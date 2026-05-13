import { Outlet, Link, useLocation } from "react-router-dom";
import { LogOut, Building2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationsBell } from "@/components/NotificationsBell";

/**
 * Layout dédié aux extranets (intervenant + client). Plus simple que le CRM
 * admin : pas de sidebar, juste un topbar avec navigation tabs + déconnexion.
 *
 * Le contenu spécifique vient des routes enfants via <Outlet />.
 */
export function ExtranetLayout({
  title,
  variant,
  tabs,
}: {
  title: string;
  variant: "intervenant" | "client";
  tabs: { to: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  const { user, logout } = useAuthStore();
  const { pathname } = useLocation();
  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const accent = variant === "intervenant" ? "bg-indigo-600" : "bg-emerald-600";

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${accent} text-white`}>
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">Aspha Pro · {title}</span>
            <span className="text-[10px] text-muted-foreground">
              {variant === "intervenant" ? "Espace intervenant" : "Espace client"}
            </span>
          </div>

          <nav className="ml-6 flex items-center gap-1">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.to);
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${active ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-xs leading-tight">
                <span className="font-medium">{user?.name}</span>
                <span className="text-[10px] text-muted-foreground">{user?.email}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
