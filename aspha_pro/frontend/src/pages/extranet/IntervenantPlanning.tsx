import { IntervenantPlanningView } from "@/pages/extranet/IntervenantPlanningView";
import { PageHeader } from "@/components/PageHeader";

/**
 * Route planning extranet intervenant (`/extranet/intervenant/planning`).
 * Le contenu est factorisé dans `IntervenantPlanningView`, partagé avec la
 * page d'accueil `IntervenantHome`.
 */
export function IntervenantPlanning() {
  return (
    <div>
      <PageHeader
        title="Mon planning"
        description="Mes interventions ponctuelles et récurrentes — survole un RDV pour les détails"
      />
      <IntervenantPlanningView />
    </div>
  );
}
