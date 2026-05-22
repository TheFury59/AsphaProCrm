import { useParams } from "react-router-dom";
import { useClient, useUpdateClient } from "@/hooks/use-clients";
import { EditableField } from "@/components/EditableField";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, FileText, FileSignature, Key, Receipt, Users, Calendar, MessageSquare, MapPin } from "lucide-react";
import { EntityAvatar } from "@/components/EntityAvatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PortalAccessCard } from "./PortalAccessCard";
import { ClientContactsTab } from "./tabs/ClientContactsTab";
import { ClientAddressesTab } from "./tabs/ClientAddressesTab";
import { ClientAbsencesTab } from "./tabs/ClientAbsencesTab";
import { ClientKeysTab } from "./tabs/ClientKeysTab";
import { ClientPortalTab } from "./tabs/ClientPortalTab";
import { ClientSalesTab } from "./tabs/ClientSalesTab";
import { ClientMissionsTab } from "./tabs/ClientMissionsTab";
import { ClientContractsTab } from "./tabs/ClientContractsTab";
import { DocumentsTab } from "@/pages/shared/DocumentsTab";

export function ClientFichePage() {
  const { id } = useParams();
  const clientId = id ? parseInt(id, 10) : null;
  const { data: c, isLoading } = useClient(clientId);
  const updateClient = useUpdateClient();

  const updateCompany = async (field: string, value: string | null) => {
    if (!clientId) return;
    await updateClient.mutateAsync({ id: clientId, patch: { company: { [field]: value } as any } });
  };

  const updateBilling = async (field: string, value: string | null) => {
    if (!clientId) return;
    await updateClient.mutateAsync({ id: clientId, patch: { billing_contact: { [field]: value } as any } });
  };

  // B6/F2 — consignes libres pour les intervenants (champ direct sur le client).
  const updateIntervenantNotes = async (value: string | null) => {
    if (!clientId) return;
    await updateClient.mutateAsync({ id: clientId, patch: { intervenant_notes: value } });
  };

  if (isLoading || !c || !clientId) {
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
      <div className="flex items-center gap-4 mb-6">
        <EntityAvatar
          src={c.company?.logo_url}
          name={c.company?.company_name ?? c.display_name}
          variant="client"
          size="lg"
        />
        <div className="flex-1 min-w-0">
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
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Général</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-3.5 w-3.5 mr-1.5" /> Contacts</TabsTrigger>
          <TabsTrigger value="addresses"><MapPin className="h-3.5 w-3.5 mr-1.5" /> Adresses</TabsTrigger>
          <TabsTrigger value="absences"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Absences ({c.counts?.absences ?? 0})</TabsTrigger>
          <TabsTrigger value="keys"><Key className="h-3.5 w-3.5 mr-1.5" /> Clés ({c.counts?.keys ?? 0})</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" /> Documents</TabsTrigger>
          <TabsTrigger value="missions"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Missions ({c.counts?.missions ?? 0})</TabsTrigger>
          <TabsTrigger value="contracts"><FileSignature className="h-3.5 w-3.5 mr-1.5" /> Contrats</TabsTrigger>
          <TabsTrigger value="sales"><Receipt className="h-3.5 w-3.5 mr-1.5" /> Devis & factures</TabsTrigger>
          <TabsTrigger value="requests"><MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Demandes</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Logo de l'entreprise</CardTitle>
                <CardDescription>S'affiche dans les listes, devis, factures et extranet client.</CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarUpload
                  type="client"
                  id={clientId}
                  src={c.company?.logo_url}
                  name={c.company?.company_name ?? c.display_name}
                />
              </CardContent>
            </Card>

            <PortalAccessCard
              type="client"
              entityId={clientId}
              portalUser={c.portal_user}
              defaultEmail={c.company?.primary_email ?? ""}
              // Emails déjà connus pour ce client : primary_email + tous les contacts
              // de type "email" + email du contact de facturation. Permet à l'admin
              // de cliquer un chip au lieu de retaper.
              availableEmails={[
                c.company?.primary_email,
                c.billing_contact?.email,
                ...(c.contacts?.filter((ct) => ct.type === "email").map((ct) => ct.value) ?? []),
              ].filter((e): e is string => !!e?.trim())}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Entreprise</CardTitle>
                <CardDescription>Identité juridique et coordonnées principales</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <EditableRow label="Raison sociale" value={c.company?.company_name} onSave={(v) => updateCompany("company_name", v)} />
                <EditableRow label="Forme juridique" value={c.company?.legal_form} onSave={(v) => updateCompany("legal_form", v)} />
                <EditableRow label="SIRET" value={c.company?.siret} mono onSave={(v) => updateCompany("siret", v)} />
                <EditableRow label="N° TVA" value={c.company?.vat_number} mono onSave={(v) => updateCompany("vat_number", v)} />
                <EditableRow label="Téléphone fixe" value={c.company?.phone_landline} type="tel" onSave={(v) => updateCompany("phone_landline", v)} />
                <EditableRow label="Téléphone mobile" value={c.company?.phone_mobile} type="tel" onSave={(v) => updateCompany("phone_mobile", v)} />
                <EditableRow label="Email prioritaire" value={c.company?.primary_email} type="email" onSave={(v) => updateCompany("primary_email", v)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gérant</CardTitle>
                <CardDescription>Contact principal côté direction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <EditableRow label="Civilité" value={c.company?.manager_civility} onSave={(v) => updateCompany("manager_civility", v)} />
                <EditableRow label="Prénom" value={c.company?.manager_first_name} onSave={(v) => updateCompany("manager_first_name", v)} />
                <EditableRow label="Nom" value={c.company?.manager_last_name} onSave={(v) => updateCompany("manager_last_name", v)} />
                <EditableRow label="Rôle" value={c.company?.manager_role} onSave={(v) => updateCompany("manager_role", v)} />
              </CardContent>
            </Card>

            {c.billing_contact && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Contact de facturation</CardTitle>
                  <CardDescription>Destinataire des factures et relances</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <EditableRow label="Civilité" value={c.billing_contact.civility} onSave={(v) => updateBilling("civility", v)} />
                  <EditableRow label="Prénom" value={c.billing_contact.first_name} onSave={(v) => updateBilling("first_name", v)} />
                  <EditableRow label="Nom" value={c.billing_contact.last_name} onSave={(v) => updateBilling("last_name", v)} />
                  <EditableRow label="Email" value={c.billing_contact.email} type="email" onSave={(v) => updateBilling("email", v)} />
                  <EditableRow label="Téléphone" value={c.billing_contact.phone} type="tel" onSave={(v) => updateBilling("phone", v)} />
                </CardContent>
              </Card>
            )}

            {/* B6/F2 — Consignes / infos pour les intervenants. Texte libre
                visible par l'intervenant dans son extranet (tooltip planning). */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Consignes intervenants</CardTitle>
                <CardDescription>
                  Infos pratiques transmises aux intervenants (accès, code, animal,
                  habitudes…). Visibles dans leur extranet.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <EditableField
                  value={c.intervenant_notes}
                  onSave={updateIntervenantNotes}
                  label="Consignes intervenants"
                  multiline
                  placeholder="Aucune consigne — cliquer pour ajouter."
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ClientContactsTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="addresses" className="mt-4">
          <ClientAddressesTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="absences" className="mt-4">
          <ClientAbsencesTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="keys" className="mt-4">
          <ClientKeysTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab ownerType="client" ownerId={clientId} />
        </TabsContent>

        <TabsContent value="missions" className="mt-4">
          <ClientMissionsTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="contracts" className="mt-4">
          <ClientContractsTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <ClientSalesTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <ClientPortalTab clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReadOnlyRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3 py-1 border-b last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value || <span className="text-muted-foreground/50">—</span>}</span>
    </div>
  );
}

function EditableRow({ label, value, mono, type, onSave }: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  type?: "text" | "email" | "tel" | "number";
  onSave: (v: string | null) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 py-1 border-b last:border-0 min-h-[32px]">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <EditableField value={value} onSave={onSave} label={label} mono={mono} type={type} />
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
