import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { ClientsListPage } from "@/pages/clients/ClientsListPage";
import { ClientFichePage } from "@/pages/clients/ClientFichePage";
import { CreateMissionPage } from "@/pages/clients/CreateMissionPage";
import { EditMissionPage } from "@/pages/missions/EditMissionPage";
import { MissionsListPage } from "@/pages/missions/MissionsListPage";
import { TicketsListPage } from "@/pages/tickets/TicketsListPage";
import { TicketDetailPage } from "@/pages/tickets/TicketDetailPage";
import { EmployeesListPage } from "@/pages/employees/EmployeesListPage";
import { EmployeeFichePage } from "@/pages/employees/EmployeeFichePage";
import { ProductsListPage } from "@/pages/products/ProductsListPage";
import { PlanningPage } from "@/pages/planning/PlanningPage";
import { MapPage } from "@/pages/planning/MapPage";
import { QuotesListPage } from "@/pages/sales/QuotesListPage";
import { InvoicesListPage } from "@/pages/sales/InvoicesListPage";
import { ReglementsListPage } from "@/pages/sales/ReglementsListPage";
import { StockPage } from "@/pages/stock/StockPage";
import { TelegestionPage } from "@/pages/telegestion/TelegestionPage";
import { MessagingPage } from "@/pages/messaging/MessagingPage";
import { FleetPage } from "@/pages/fleet/FleetPage";
import { ExtranetLayout } from "@/components/ExtranetLayout";
import { RoleRouter } from "@/components/RoleRouter";
import { IntervenantHome } from "@/pages/extranet/IntervenantHome";
import { IntervenantPlanning } from "@/pages/extranet/IntervenantPlanning";
import { IntervenantProfil } from "@/pages/extranet/IntervenantProfil";
import { IntervenantTicketsPage } from "@/pages/extranet/IntervenantTicketsPage";
import { ClientHome } from "@/pages/extranet/ClientHome";
import { ClientInvoicesPage } from "@/pages/extranet/ClientInvoicesPage";
import { ClientPrestationsPage } from "@/pages/extranet/ClientPrestationsPage";
import { ClientTicketsPage } from "@/pages/extranet/ClientTicketsPage";
import { Home, UserCog, Receipt, Briefcase, Ticket, MessageSquare as MsgIcon } from "lucide-react";
import { AdminSettingsPage } from "@/pages/settings/AdminSettingsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { HelpPage } from "@/pages/help/HelpPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Extranet intervenant */}
            <Route
              element={
                <ProtectedRoute>
                  <RoleRouter>
                    <ExtranetLayout
                      title="Intervenant"
                      variant="intervenant"
                      tabs={[
                        { to: "/extranet/intervenant", label: "Accueil", icon: Home },
                        { to: "/extranet/intervenant/profil", label: "Mon profil", icon: UserCog },
                        { to: "/extranet/intervenant/signalements", label: "Signalements", icon: Ticket },
                        { to: "/extranet/intervenant/messagerie", label: "Messagerie", icon: MsgIcon },
                      ]}
                    />
                  </RoleRouter>
                </ProtectedRoute>
              }
            >
              <Route path="/extranet/intervenant" element={<IntervenantHome />} />
              <Route path="/extranet/intervenant/profil" element={<IntervenantProfil />} />
              <Route path="/extranet/intervenant/planning" element={<IntervenantPlanning />} />
              <Route path="/extranet/intervenant/signalements" element={<IntervenantTicketsPage />} />
              <Route path="/extranet/intervenant/messagerie" element={<MessagingPage />} />
            </Route>

            {/* Extranet client */}
            <Route
              element={
                <ProtectedRoute>
                  <RoleRouter>
                    <ExtranetLayout
                      title="Client"
                      variant="client"
                      tabs={[
                        { to: "/extranet/client", label: "Accueil", icon: Home },
                        { to: "/extranet/client/factures", label: "Factures", icon: Receipt },
                        { to: "/extranet/client/prestations", label: "Prestations", icon: Briefcase },
                        { to: "/extranet/client/demandes", label: "Mes demandes", icon: Ticket },
                      ]}
                    />
                  </RoleRouter>
                </ProtectedRoute>
              }
            >
              <Route path="/extranet/client" element={<ClientHome />} />
              <Route path="/extranet/client/factures" element={<ClientInvoicesPage />} />
              <Route path="/extranet/client/prestations" element={<ClientPrestationsPage />} />
              <Route path="/extranet/client/demandes" element={<ClientTicketsPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <RoleRouter>
                    <AppLayout />
                  </RoleRouter>
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsListPage />} />
              <Route path="/clients/:id" element={<ClientFichePage />} />
              <Route path="/clients/:id/missions/new" element={<CreateMissionPage />} />
              <Route path="/clients/:id/missions/:missionId" element={<EditMissionPage />} />
              <Route path="/missions" element={<MissionsListPage />} />
              <Route path="/tickets" element={<TicketsListPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/intervenants" element={<EmployeesListPage />} />
              <Route path="/intervenants/:id" element={<EmployeeFichePage />} />
              <Route path="/prestations" element={<ProductsListPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/carte" element={<MapPage />} />
              <Route path="/telegestion" element={<TelegestionPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/messagerie" element={<MessagingPage />} />
              <Route path="/flotte" element={<FleetPage />} />
              <Route path="/devis" element={<QuotesListPage />} />
              <Route path="/factures" element={<InvoicesListPage />} />
              <Route path="/reglements" element={<ReglementsListPage />} />
              <Route path="/parametres" element={<AdminSettingsPage />} />
              <Route path="/profil" element={<ProfilePage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/aide" element={<HelpPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
