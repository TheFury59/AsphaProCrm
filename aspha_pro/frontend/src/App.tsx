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
import { EmployeesListPage } from "@/pages/employees/EmployeesListPage";
import { EmployeeFichePage } from "@/pages/employees/EmployeeFichePage";
import { ProductsListPage } from "@/pages/products/ProductsListPage";
import { PlanningPage } from "@/pages/planning/PlanningPage";
import { QuotesListPage } from "@/pages/sales/QuotesListPage";
import { InvoicesListPage } from "@/pages/sales/InvoicesListPage";

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
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsListPage />} />
              <Route path="/clients/:id" element={<ClientFichePage />} />
              <Route path="/intervenants" element={<EmployeesListPage />} />
              <Route path="/intervenants/:id" element={<EmployeeFichePage />} />
              <Route path="/prestations" element={<ProductsListPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/devis" element={<QuotesListPage />} />
              <Route path="/factures" element={<InvoicesListPage />} />
              <Route path="/parametres" element={<PlaceholderPage title="Paramètres" phase="Phase ultérieure" />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
