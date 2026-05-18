import { Receipt, FileText, Briefcase, Ticket as TicketIcon } from "lucide-react";
import {
  useClientInvoices, useClientPrestations, useClientQuotes, useClientTickets,
} from "@/hooks/use-extranet";
import {
  ClientGreetingHeader, StatCard,
  ClientInvoicesSection, ClientPrestationsSection, ClientTicketsSection,
} from "./client-sections";

/**
 * Accueil de l'extranet client — vue d'overview.
 *
 * Affiche en compact : header + 4 stat cards + les 3 sections principales
 * (Tickets, Factures, Prestations) pour que le client voie tout son état
 * sur une seule page.
 *
 * Pour une vue détaillée, le client clique sur les onglets du menu top
 * (Factures, Prestations, Mes demandes) qui pointent vers les pages
 * dédiées (ClientInvoicesPage, etc.).
 */
export function ClientHome() {
  const { data: invoices = [] } = useClientInvoices();
  const { data: quotes = [] } = useClientQuotes();
  const { data: prestations = [] } = useClientPrestations();
  const { data: tickets = [] } = useClientTickets();

  return (
    <div className="space-y-4">
      <ClientGreetingHeader />

      <div className="grid md:grid-cols-4 gap-3">
        <StatCard label="Factures" value={invoices.length} icon={Receipt} />
        <StatCard label="Devis" value={quotes.length} icon={FileText} />
        <StatCard
          label="Prestations actives"
          value={prestations.filter((p: any) => !p.end_date).length}
          icon={Briefcase}
        />
        <StatCard
          label="Demandes ouvertes"
          value={tickets.filter((t: any) => t.status !== "resolved" && t.status !== "closed").length}
          icon={TicketIcon}
        />
      </div>

      <ClientTicketsSection />
      <ClientInvoicesSection />
      <ClientPrestationsSection />
    </div>
  );
}
