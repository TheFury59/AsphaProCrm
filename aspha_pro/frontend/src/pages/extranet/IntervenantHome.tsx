import { Calendar, FileText, GraduationCap, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIntervenantContract, useIntervenantProfile } from "@/hooks/use-extranet";
import { usePublicSettings } from "@/hooks/use-planning-summary";

/**
 * Page d'accueil intervenant : profil + contrat + lien Silae pour fiches de paie.
 */
export function IntervenantHome() {
  const { data: profile } = useIntervenantProfile();
  const { data: contract } = useIntervenantContract();
  const { data: settings } = usePublicSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour {profile?.name?.split(" ")[0] ?? ""}</h1>
        <p className="text-sm text-muted-foreground">Voici un récap de ton dossier.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Mon contrat</CardTitle>
          </CardHeader>
          <CardContent>
            {contract ? (
              <div className="space-y-1 text-sm">
                <Row label="Poste" value={contract.position} />
                <Row label="Type" value={contract.contract_type} />
                <Row label="Temps" value={contract.work_time_type} />
                <Row label="Durée mensuelle" value={contract.monthly_duration ? `${contract.monthly_duration} h` : "—"} />
                <Row label="Date d'entrée" value={contract.start_date} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun contrat actif enregistré.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Fiches de paie</CardTitle>
            <CardDescription>Gérées sur Silae</CardDescription>
          </CardHeader>
          <CardContent>
            {settings?.silae_portal_url ? (
              <a href={settings.silae_portal_url} target="_blank" rel="noopener noreferrer">
                <Button className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ouvrir le portail Silae
                </Button>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Portail Silae non configuré.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Mon profil</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-x-6 text-sm">
            <Row label="Nom complet" value={profile?.name} />
            <Row label="Email" value={profile?.user?.email} />
            <Row label="Téléphone" value={profile?.phone} />
            <Row label="Entité" value={profile?.entity?.name} />
            <Row label="Classification" value={profile?.classification === "cadre" ? "Cadre" : "Non-cadre"} />
            {profile?.skills && (
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground py-1">Compétences</div>
                <div className="flex flex-wrap gap-1">
                  {profile.skills.map((s: any) => <Badge key={s.id} variant="secondary">{s.name ?? s.label}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between border-b py-1 last:border-0 gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? <span className="text-muted-foreground/50">—</span>}</span>
    </div>
  );
}
