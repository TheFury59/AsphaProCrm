import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/**
 * Redirige les utilisateurs vers leur espace dédié selon leur rôle.
 *
 *  - super_admin / admin   → reste sur le CRM (/)
 *  - intervenant           → /extranet/intervenant
 *  - client                → /extranet/client
 *
 * Si le user accède à une route qui n'est pas la sienne par défaut, on le
 * redirige (sauf s'il est admin auquel cas il voit tout).
 */
export function RoleRouter({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();

  if (!user) return <>{children}</>;

  const role = user.role;

  // intervenant : forcé sur /extranet/intervenant/*
  if (role === "intervenant" && !pathname.startsWith("/extranet/intervenant")) {
    return <Navigate to="/extranet/intervenant" replace />;
  }
  // client : forcé sur /extranet/client/*
  if (role === "client" && !pathname.startsWith("/extranet/client")) {
    return <Navigate to="/extranet/client" replace />;
  }
  // admin / super_admin : pas d'extranet (UI dédiée intervenant/client cassée
  // pour eux car les hooks /extranet/* attendent un employee_id ou client_id
  // lié au user). Si un admin se reconnecte sur une URL extranet (cas typique
  // : logout intervenant → login admin sur la même session), on le ramène
  // vers le dashboard CRM `/`.
  if ((role === "super_admin" || role === "admin") && pathname.startsWith("/extranet/")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
