import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, status, fetchMe } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (status === "idle") void fetchMe();
  }, [status, fetchMe]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Tâche A2 — compte créé par un admin (mot de passe temporaire) : on force
  // le passage par /change-password AVANT toute autre route. La page
  // /change-password elle-même reste accessible (sinon boucle infinie).
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
