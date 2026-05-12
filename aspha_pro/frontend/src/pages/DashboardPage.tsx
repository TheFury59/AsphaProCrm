import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";

export function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenue {user?.name}. Voici l'état actuel d'Aspha Pro.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clients actifs</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Phase 2 à venir</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Intervenants</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Phase 2 à venir</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interventions cette semaine</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Phase 3 à venir</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Devis en attente</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Phase 3 à venir</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statut de l'environnement</CardTitle>
          <CardDescription>Phase 0 — Bootstrap terminé</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Backend Laravel 11 + Sanctum</span>
            <Badge>OK</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Frontend React + Tailwind v4 + shadcn/ui</span>
            <Badge>OK</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Authentification cookie-based</span>
            <Badge>OK</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>API versionnée /api/v1/</span>
            <Badge>OK</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Schéma BDD complet (60 tables)</span>
            <Badge variant="secondary">Phase 1</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
