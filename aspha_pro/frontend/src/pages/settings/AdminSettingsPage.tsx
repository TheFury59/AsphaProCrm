import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Shield, FileWarning, Lock, Building2 } from "lucide-react";
import { SettingsPage } from "./SettingsPage";
import { PermissionsMatrix } from "./PermissionsMatrix";
import { RequiredDocsManager } from "./RequiredDocsManager";
import { EntityCompanyTab } from "./EntityCompanyTab";
import { useAuthStore } from "@/stores/auth";

/**
 * Page d'administration "Paramètres" — 3 onglets :
 *  - Paramètres globaux (seuils, intégrations) — admin + super_admin
 *  - Matrice de permissions par rôle — SUPER_ADMIN UNIQUEMENT
 *  - Référentiel docs requis intervenants — admin + super_admin
 *
 * Décision métier 2026-05-18 : l'onglet Permissions est réservé super_admin.
 * Les admin normaux voient l'onglet grisé avec un cadenas + message
 * explicatif (au lieu de le cacher, pour montrer que la fonctionnalité
 * existe mais nécessite un autre rôle).
 */
export function AdminSettingsPage() {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === "super_admin");

  return (
    <div>
      <PageHeader title="Paramètres" description="Configuration globale, permissions et référentiels." />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="mr-2 h-3 w-3" />Mon entreprise</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="mr-2 h-3 w-3" />Paramètres</TabsTrigger>
          <TabsTrigger value="permissions" disabled={!isSuperAdmin}>
            {isSuperAdmin
              ? <Shield className="mr-2 h-3 w-3" />
              : <Lock className="mr-2 h-3 w-3" />}
            Permissions
          </TabsTrigger>
          <TabsTrigger value="docs"><FileWarning className="mr-2 h-3 w-3" />Docs requis</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-4">
          <EntityCompanyTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          {/* Réutilise SettingsPage mais sans son propre PageHeader (on a celui d'au-dessus) */}
          <SettingsPageBody />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          {isSuperAdmin ? (
            <PermissionsMatrix />
          ) : (
            <div className="rounded-2xl bg-card shadow-soft p-8 text-center">
              <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <div className="text-sm font-medium">Accès réservé aux super-administrateurs</div>
              <div className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                La matrice de permissions définit ce que chaque rôle peut faire.
                Pour modifier ces réglages, contacte un super-administrateur.
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <RequiredDocsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Petit wrapper : SettingsPage embarque son propre PageHeader, ici on extrait juste le body
function SettingsPageBody() {
  return <SettingsPage />;
}
