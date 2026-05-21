import { ClientGreetingHeader, ClientQuotesSection } from "./client-sections";

/**
 * Page extranet client — vue dédiée aux devis.
 *
 * Le client y consulte ses devis, télécharge le PDF et valide (ou refuse)
 * les devis en attente (statut « À valider »).
 *
 * Route : /extranet/client/devis
 */
export function ClientQuotesPage() {
  return (
    <div className="space-y-4">
      <ClientGreetingHeader subtitle="Consultez et validez les devis qui vous sont proposés." />
      <ClientQuotesSection />
    </div>
  );
}
