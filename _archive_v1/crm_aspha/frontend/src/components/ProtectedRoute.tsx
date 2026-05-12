import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, status, fetchMe } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (status === "idle") void fetchMe();
  }, [status, fetchMe]);

  if (status === "idle" || status === "loading") {
    return <div className="p-8 text-center text-muted-foreground">Chargement…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
