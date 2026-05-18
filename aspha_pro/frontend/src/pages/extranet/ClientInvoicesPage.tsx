import { ClientGreetingHeader, ClientInvoicesSection } from "./client-sections";

/**
 * Page extranet client — vue dédiée aux factures.
 *
 * Route : /extranet/client/factures
 */
export function ClientInvoicesPage() {
  return (
    <div className="space-y-4">
      <ClientGreetingHeader subtitle="Toutes vos factures avec téléchargement PDF." />
      <ClientInvoicesSection />
    </div>
  );
}
