import { useIntervenantProfile } from "@/hooks/use-extranet";
import { IntervenantPlanningView } from "@/pages/extranet/IntervenantPlanningView";

/**
 * Page d'accueil intervenant (`/extranet/intervenant`) : affiche directement
 * le planning complet (calendrier + panneaux contrat/trajets sur le côté droit).
 * Le profil, le contrat et le lien Silae sont sur la route dédiée
 * `/extranet/intervenant/profil` (cf. IntervenantProfil).
 */
export function IntervenantHome() {
  const { data: profile } = useIntervenantProfile();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour {profile?.name?.split(" ")[0] ?? ""}</h1>
        <p className="text-sm text-muted-foreground">
          Voici ton planning — survole un RDV pour les détails.
        </p>
      </div>

      <IntervenantPlanningView />
    </div>
  );
}
