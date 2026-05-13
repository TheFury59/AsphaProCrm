import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Shield, FileWarning } from "lucide-react";
import { SettingsPage } from "./SettingsPage";
import { PermissionsMatrix } from "./PermissionsMatrix";
import { RequiredDocsManager } from "./RequiredDocsManager";

/**
 * Page d'administration "Paramètres" — 3 onglets :
 *  - Paramètres globaux (seuils, intégrations)
 *  - Matrice de permissions par rôle
 *  - Référentiel docs requis intervenants
 */
export function AdminSettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres" description="Configuration globale, permissions et référentiels." />
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Settings className="mr-2 h-3 w-3" />Paramètres</TabsTrigger>
          <TabsTrigger value="permissions"><Shield className="mr-2 h-3 w-3" />Permissions</TabsTrigger>
          <TabsTrigger value="docs"><FileWarning className="mr-2 h-3 w-3" />Docs requis</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-4">
          {/* Réutilise SettingsPage mais sans son propre PageHeader (on a celui d'au-dessus) */}
          <SettingsPageBody />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsMatrix />
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
