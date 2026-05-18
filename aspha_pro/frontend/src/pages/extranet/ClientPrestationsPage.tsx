import { ClientGreetingHeader, ClientPrestationsSection } from "./client-sections";

/**
 * Page extranet client — vue dédiée aux prestations contractualisées.
 *
 * Route : /extranet/client/prestations
 */
export function ClientPrestationsPage() {
  return (
    <div className="space-y-4">
      <ClientGreetingHeader subtitle="Détail des prestations actives et passées." />
      <ClientPrestationsSection />
    </div>
  );
}
