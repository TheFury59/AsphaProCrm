import { useNavigate, useParams } from "react-router-dom";
import { useEmployee, useUpdateEmployee, useDeleteEmployee } from "@/hooks/use-employees";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { EditableField } from "@/components/EditableField";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { User, FileText, Award, Calendar, GraduationCap, Receipt, Wallet, MapPin } from "lucide-react";
import { EmployeeSkillsTab } from "./tabs/EmployeeSkillsTab";
import { EmployeeAddressesTab } from "./tabs/EmployeeAddressesTab";
import { EmployeeAbsencesTab } from "./tabs/EmployeeAbsencesTab";
import { EmployeeTrainingsTab } from "./tabs/EmployeeTrainingsTab";
import { SalaryDeductionsTab } from "./tabs/SalaryDeductionsTab";
import { ContractFormDialog } from "./tabs/ContractFormDialog";
import { EmployeePlanningTab } from "./tabs/EmployeePlanningTab";
import { EmployeeTicketsTab } from "./tabs/EmployeeTicketsTab";
import { EmployeeScoreTab } from "./tabs/EmployeeScoreTab";
import { DocumentsTab } from "@/pages/shared/DocumentsTab";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Ticket, Star } from "lucide-react";
import { EntityAvatar } from "@/components/EntityAvatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PortalAccessCard } from "@/pages/clients/PortalAccessCard";

export function EmployeeFichePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const employeeId = id ? parseInt(id, 10) : null;
  const { data: e, isLoading } = useEmployee(employeeId);
  const updateEmp = useUpdateEmployee();
  const deleteEmp = useDeleteEmployee();
  const [contractOpen, setContractOpen] = useState(false);

  const updateField = async (field: string, value: string | null) => {
    if (!employeeId) return;
    await updateEmp.mutateAsync({ id: employeeId, patch: { [field]: value } as any });
  };

  const handleDelete = async () => {
    if (!employeeId || !e) return;
    const confirmation = prompt(
      `⚠️ SUPPRESSION DÉFINITIVE\n\n` +
        `Tu vas supprimer COMPLÈTEMENT la fiche de "${e.full_name}" et toutes ` +
        `ses données liées (contrats, compétences, formations, absences, ` +
        `interventions passées, documents…). IRRÉVERSIBLE.\n\n` +
        `Pour confirmer, retape exactement le nom : ${e.full_name}`,
    );
    if (confirmation === null) return;
    if (confirmation.trim() !== e.full_name) {
      toast.error("Le nom ne correspond pas — suppression annulée.");
      return;
    }
    try {
      await deleteEmp.mutateAsync({ id: employeeId });
      toast.success(`Intervenant "${e.full_name}" supprimé.`);
      navigate("/intervenants");
    } catch (err: any) {
      if (err?.response?.status === 409 && err?.response?.data?.message?.includes("intervention")) {
        if (confirm(`${err.response.data.message}\n\nForcer la suppression quand même ?`)) {
          try {
            await deleteEmp.mutateAsync({ id: employeeId, force: true });
            toast.success(`Intervenant "${e.full_name}" supprimé (forçage).`);
            navigate("/intervenants");
            return;
          } catch (e2: any) {
            toast.error(e2?.response?.data?.message ?? "Suppression impossible");
            return;
          }
        }
        return;
      }
      toast.error(err?.response?.data?.message ?? "Suppression impossible");
    }
  };

  if (isLoading || !e || !employeeId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <EntityAvatar src={e.avatar_url} name={e.full_name} variant="employee" size="lg" />
        <div className="flex-1 min-w-0">
          <PageHeader
            title={e.full_name}
            description={`${e.classification === "cadre" ? "Cadre" : "Non-cadre"}${e.current_contract?.position ? ` · ${e.current_contract.position}` : ""}`}
            backTo="/intervenants"
            actions={
              <>
                {e.has_company_vehicle && <Badge>Véhicule service</Badge>}
                {e.entity && <Badge variant="outline">{e.entity.name}</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleteEmp.isPending}
                  onClick={handleDelete}
                  className="text-rose-700 hover:text-rose-900 hover:bg-rose-50 gap-1.5"
                  title="Supprimer définitivement cet intervenant"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-xs">Supprimer</span>
                </Button>
              </>
            }
          />
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general"><User className="h-3.5 w-3.5 mr-1.5" /> Général</TabsTrigger>
          <TabsTrigger value="contract"><FileText className="h-3.5 w-3.5 mr-1.5" /> Contrat</TabsTrigger>
          <TabsTrigger value="address"><MapPin className="h-3.5 w-3.5 mr-1.5" /> Adresse</TabsTrigger>
          <TabsTrigger value="skills"><Award className="h-3.5 w-3.5 mr-1.5" /> Compétences ({e.skills?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="absences"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Absences ({e.counts?.absences ?? 0})</TabsTrigger>
          <TabsTrigger value="trainings"><GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Formations ({e.counts?.trainings ?? 0})</TabsTrigger>
          <TabsTrigger value="planning"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Planning ({e.counts?.interventions ?? 0})</TabsTrigger>
          <TabsTrigger value="payroll"><Wallet className="h-3.5 w-3.5 mr-1.5" /> Saisies ({e.counts?.salary_deductions ?? 0})</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="h-3.5 w-3.5 mr-1.5" /> Tickets</TabsTrigger>
          <TabsTrigger value="score"><Star className="h-3.5 w-3.5 mr-1.5" /> Notation</TabsTrigger>
          <TabsTrigger value="documents"><Receipt className="h-3.5 w-3.5 mr-1.5" /> Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Photo de profil</CardTitle>
                <CardDescription>S'affiche sur le planning, la messagerie et le portail intervenant.</CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarUpload
                  type="employee"
                  id={employeeId}
                  src={e.avatar_url}
                  name={e.full_name}
                />
              </CardContent>
            </Card>

            <PortalAccessCard
              type="employee"
              entityId={employeeId}
              portalUser={e.user}
              // Email perso saisi sur la fiche → pré-rempli
              defaultEmail={e.email ?? ""}
              // Emails déjà connus pour cet intervenant : email perso + email
              // du compte de connexion existant si présent. Les chips permettent
              // à l'admin de cliquer au lieu de retaper.
              availableEmails={[e.email, e.user?.email].filter((x): x is string => !!x?.trim())}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <EditableRow label="Nom complet" value={e.name} onSave={(v) => updateField("name", v)} />
                <EditableRow label="Téléphone" value={e.phone} type="tel" onSave={(v) => updateField("phone", v)} />
                <EditableRow label="Email personnel" value={e.email} type="email" onSave={(v) => updateField("email", v)} />
                <Field label="Classification" value={e.classification === "cadre" ? "Cadre" : "Non-cadre"} />
                <EditableRow label="Mode déplacement" value={e.transport_mode} onSave={(v) => updateField("transport_mode", v)} />
                <Field label="Véhicule service" value={e.has_company_vehicle ? "Oui (jamais véhicule perso)" : "Non"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compte utilisateur</CardTitle>
                <CardDescription>Accès à l'application (mobile, extranet)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {e.user ? (
                  <>
                    <Field label="Nom" value={e.user.name} />
                    <Field label="Email" value={e.user.email} />
                    <Field label="Statut" value={e.user.status} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Pas de compte utilisateur associé.</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Diplômes & emploi repère</CardTitle>
                <CardDescription>Champs libres</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Diplômes</span>
                  <div className="mt-1">
                    <EditableField value={e.diploma} onSave={(v) => updateField("diploma", v)} label="Diplômes" multiline />
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Emploi repère</span>
                  <div className="mt-1">
                    <EditableField value={e.job_reference_free} onSave={(v) => updateField("job_reference_free", v)} label="Emploi repère" multiline />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contract" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contrat actuel</CardTitle>
              <CardDescription>Détails du contrat en cours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {e.current_contract ? (
                <>
                  <Field label="Poste" value={e.current_contract.position} />
                  <Field label="Zone d'intervention" value={e.current_contract.intervention_zone} />
                  <Field label="Type" value={e.current_contract.contract_type} />
                  <Field label="Temps" value={e.current_contract.work_time_type} />
                  <Field label="Durée mensuelle" value={e.current_contract.monthly_duration ? `${e.current_contract.monthly_duration} h/mois` : null} />
                  <Field label="Durée hebdo" value={e.current_contract.weekly_duration ? `${e.current_contract.weekly_duration} h/sem` : null} />
                  <Field label="Mode paie" value={e.current_contract.pay_mode} />
                  <Field label="Salaire mensuel" value={e.current_contract.monthly_salary ? `${e.current_contract.monthly_salary} €` : null} />
                  <Field label="Taux horaire" value={e.current_contract.hourly_rate ? `${e.current_contract.hourly_rate} €/h` : null} />
                  <Field label="Indemnité km inter-vacation" value={e.current_contract.km_rate_inter_vacation ? `${e.current_contract.km_rate_inter_vacation} €/km` : null} />
                  <Field label="Indemnité km intervention" value={e.current_contract.km_rate_intervention ? `${e.current_contract.km_rate_intervention} €/km` : null} />
                  <Field label="Date d'entrée" value={e.current_contract.start_date} />
                </>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Aucun contrat actif.</p>
                  <Button size="sm" onClick={() => setContractOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Créer un contrat
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address" className="mt-4">
          <EmployeeAddressesTab employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <EmployeeSkillsTab employeeId={employeeId} currentSkillIds={(e.skills ?? []).map((s) => s.id)} />
        </TabsContent>

        <TabsContent value="absences" className="mt-4">
          <EmployeeAbsencesTab employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="trainings" className="mt-4">
          <EmployeeTrainingsTab employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab ownerType="employee" ownerId={employeeId} />
        </TabsContent>

        <TabsContent value="planning" className="mt-4">
          <EmployeePlanningTab employeeId={employeeId} />
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <SalaryDeductionsTab employeeId={employeeId} />
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <EmployeeTicketsTab employeeId={employeeId} />
        </TabsContent>
        <TabsContent value="score" className="mt-4">
          <EmployeeScoreTab employeeId={employeeId} />
        </TabsContent>
      </Tabs>

      {contractOpen && e.entity && (
        <ContractFormDialog
          employeeId={employeeId}
          entityId={e.entity.id}
          open={contractOpen}
          onClose={() => setContractOpen(false)}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-baseline gap-3 py-1 border-b last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{value ?? <span className="text-muted-foreground/50">—</span>}</span>
    </div>
  );
}

function EditableRow({ label, value, type, onSave }: {
  label: string;
  value: string | null | undefined;
  type?: "text" | "email" | "tel" | "number";
  onSave: (v: string | null) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1 border-b last:border-0 min-h-[32px]">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <EditableField value={value} onSave={onSave} label={label} type={type} />
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
