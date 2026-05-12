import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

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
              <Route path="/clients" element={<PlaceholderPage title="Clients" phase="Phase 2" />} />
              <Route path="/intervenants" element={<PlaceholderPage title="Intervenants" phase="Phase 2" />} />
              <Route path="/prestations" element={<PlaceholderPage title="Prestations" phase="Phase 2" />} />
              <Route path="/planning" element={<PlaceholderPage title="Planning" phase="Phase 3" />} />
              <Route path="/devis" element={<PlaceholderPage title="Devis" phase="Phase 3" />} />
              <Route path="/factures" element={<PlaceholderPage title="Factures" phase="Phase 3" />} />
              <Route path="/parametres" element={<PlaceholderPage title="Paramètres" phase="Phase ultérieure" />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
