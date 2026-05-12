import { useParams } from "react-router-dom";
import { useClient } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, FileText, Key, Receipt, Users, Calendar, MessageSquare } from "lucide-react";

export function ClientFichePage() {
  const { id } = useParams();
  const clientId = id ? parseInt(id, 10) : null;
  const { data: c, isLoading } = useClient(clientId);

  if (isLoading || !c) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={c.company?.company_name ?? c.display_name}
        description={`Code ${c.code} · ${c.company?.siret ? `SIRET ${c.company.siret}` : "Pas de SIRET"}`}
        backTo="/clients"
        actions={
          <>
            <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
            {c.entity && <Badge variant="outline">{c.entity.name}</Badge>}
          </>
        }
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Général</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-3.5 w-3.5 mr-1.5" /> Contacts</TabsTrigger>
          <TabsTrigger value="missions"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Missions ({c.counts?.missions ?? 0})</TabsTrigger>
          <TabsTrigger value="absences"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Absences ({c.counts?.absences ?? 0})</TabsTrigger>
          <TabsTrigger value="keys"><Key className="h-3.5 w-3.5 mr-1.5" /> Clés ({c.counts?.keys ?? 0})</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" /> Documents</TabsTrigger>
          <TabsTrigger value="sales"><Receipt className="h-3.5 w-3.5 mr-1.5" /> Devis & factures</TabsTrigger>
          <TabsTrigger value="requests"><MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Demandes</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Entreprise</CardTitle>
                <CardDescription>Identité juridique et coordonnées principales</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Raison sociale" value={c.company?.company_name} />
                <Field label="Forme juridique" value={c.company?.legal_form} />
                <Field label="SIRET" value={c.company?.siret} mono />
                <Field label="N° TVA" value={c.company?.vat_number} mono />
                <Field label="Téléphone fixe" value={c.company?.phone_landline} />
                <Field label="Téléphone mobile" value={c.company?.phone_mobile} />
                <Field label="Email prioritaire" value={c.company?.primary_email} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gérant</CardTitle>
                <CardDescription>Contact principal côté direction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Civilité" value={c.company?.manager_civility} />
                <Field label="Prénom" value={c.company?.manager_first_name} />
                <Field label="Nom" value={c.company?.manager_last_name} />
                <Field label="Rôle" value={c.company?.manager_role} />
              </CardContent>
            </Card>

            {c.billing_contact && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Contact de facturation</CardTitle>
                  <CardDescription>Destinataire des factures et relances</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Field label="Nom" value={`${c.billing_contact.civility ?? ""} ${c.billing_contact.first_name ?? ""} ${c.billing_contact.last_name ?? ""}`.trim()} />
                  <Field label="Email" value={c.billing_contact.email} />
                  <Field label="Téléphone" value={c.billing_contact.phone} />
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Adresses</CardTitle>
                <CardDescription>{c.addresses?.length ?? 0} adresse(s) enregistrée(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {c.addresses && c.addresses.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {c.addresses.map((a) => (
                      <li key={a.id} className="rounded border p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{a.type}</Badge>
                        </div>
                        <div>{a.address}</div>
                        <div className="text-muted-foreground">{a.postal_code} {a.city}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune adresse renseignée.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Téléphones, emails, contacts liés (famille, médecin, urgence)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Contacts entreprise ({c.contacts?.length ?? 0})</h4>
                {c.contacts?.length ? (
                  <ul className="space-y-1 text-sm">
                    {c.contacts.map((ct) => (
                      <li key={ct.id} className="flex items-center justify-between border-b py-1">
                        <span>
                          <Badge variant="outline" className="mr-2 text-xs">{ct.type}</Badge>
                          {ct.value}
                        </span>
                        {ct.is_primary && <Badge>Prioritaire</Badge>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Aucun contact.</p>}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Contacts liés ({c.related_contacts?.length ?? 0})</h4>
                {c.related_contacts?.length ? (
                  <ul className="space-y-1 text-sm">
                    {c.related_contacts.map((rc) => (
                      <li key={rc.id} className="flex items-center justify-between border-b py-1">
                        <span>
                          <Badge variant="outline" className="mr-2 text-xs">{rc.type}</Badge>
                          {rc.name}
                        </span>
                        <span className="text-muted-foreground">{rc.phone}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Aucun contact lié.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missions" className="mt-4">
          <PlaceholderTab title="Missions" phase="Phase 3" />
        </TabsContent>
        <TabsContent value="absences" className="mt-4">
          <PlaceholderTab title="Absences client (ponctuelles + périodiques)" phase="Phase 2.5" />
        </TabsContent>
        <TabsContent value="keys" className="mt-4">
          <PlaceholderTab title="Clés + historique mouvements" phase="Phase 2.5" />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <PlaceholderTab title="Documents (upload, contrats signés, factures)" phase="Phase 2.5" />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <PlaceholderTab title="Devis & factures" phase="Phase 3" />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <PlaceholderTab title="Réclamations & réassorts (portail client)" phase="Phase 5" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3 py-1 border-b last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>
        {value || <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  );
}

function PlaceholderTab({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Module à venir.</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">{phase}</Badge>
      </CardContent>
    </Card>
  );
}
