import { ClientGreetingHeader, ClientTicketsSection } from "./client-sections";

/**
 * Page extranet client — vue dédiée aux tickets / demandes.
 *
 * Route : /extranet/client/demandes
 */
export function ClientTicketsPage() {
  return (
    <div className="space-y-4">
      <ClientGreetingHeader subtitle="Vos demandes envoyées et leur suivi par notre équipe." />
      <ClientTicketsSection />
    </div>
  );
}
