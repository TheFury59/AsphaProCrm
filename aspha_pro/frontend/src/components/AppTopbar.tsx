import { LogOut, Search, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { NotificationsBell } from "@/components/NotificationsBell";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppTopbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-md px-4 sticky top-0 z-30">
      <SidebarTrigger className="-ml-1 cursor-pointer" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex-1">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 hover:bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full max-w-md cursor-pointer group"
        >
          <Search className="h-4 w-4 group-hover:text-primary transition-colors" />
          <span>Rechercher clients, intervenants, devis…</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      <NotificationsBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 cursor-pointer hover:bg-accent">
            <Avatar className="h-7 w-7 ring-2 ring-primary/30 ring-offset-1 ring-offset-background">
              <AvatarFallback className="text-xs bg-gradient-aspha text-white font-medium">
                {user ? initials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start text-xs leading-tight">
              <span className="font-medium">{user?.name}</span>
              <span className="text-muted-foreground text-[10px]">{user?.role}</span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            Mon profil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
