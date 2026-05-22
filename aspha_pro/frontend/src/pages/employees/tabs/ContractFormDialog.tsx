import { useState } from "react";
import { useCreateContract } from "@/hooks/use-phase3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { apiErrorMessage } from "@/lib/api";

type Props = {
  employeeId: number;
  entityId: number;
  open: boolean;
  onClose: () => void;
};

export function ContractFormDialog({ employeeId, entityId, open, onClose }: Props) {
  const create = useCreateContract(employeeId);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    entity_id: entityId,
    position: "",
    intervention_zone: "",
    contract_type: "cdi",
    is_current: true,
    start_date: new Date().toISOString().slice(0, 10),
    work_time_type: "full_time",
    monthly_duration: 151.67,
    weekly_duration: 35,
    pay_mode: "monthly_salary",
    monthly_salary: "",
    hourly_rate: "",
    km_rate_inter_vacation: 0.35,
    employee_status: "non_cadre",
    geographic_zone: "france_metro",
    comment: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // Coerce numeric strings
      const payload = { ...form };
      ["monthly_duration", "weekly_duration", "monthly_salary", "hourly_rate", "km_rate_inter_vacation"]
        .forEach((k) => {
          if (payload[k] === "" || payload[k] === null) delete payload[k];
          else payload[k] = parseFloat(payload[k]);
        });
      await create.mutateAsync(payload);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "Création du contrat impossible"));
    }
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau contrat</DialogTitle>
          <DialogDescription>
            Création d'un contrat actif pour cet intervenant. Les contrats précédents seront archivés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="time">Temps & rémun.</TabsTrigger>
              <TabsTrigger value="km">Indemnités km</TabsTrigger>
              <TabsTrigger value="payroll">Paie</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-3">
              <Card><CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type de contrat *</Label>
                    <select value={form.contract_type} onChange={(e) => set("contract_type", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                      <option value="cdi">CDI</option>
                      <option value="cdd">CDD</option>
                      <option value="stage">Convention de stage</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Poste *</Label>
                    <Input value={form.position} onChange={(e) => set("position", e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Zone d'intervention</Label>
                  <Input value={form.intervention_zone} onChange={(e) => set("intervention_zone", e.target.value)} placeholder="Ex. Centre-ville, Nord, agglo…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date de début *</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} required />
                </div>
                {form.contract_type === "cdd" && (
                  <div className="space-y-1.5">
                    <Label>Date de fin (CDD)</Label>
                    <Input type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.is_current} onChange={(e) => set("is_current", e.target.checked)} />
                  Contrat actif (désactive les contrats précédents)
                </label>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="time" className="mt-3">
              <Card><CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Temps</Label>
                    <select value={form.work_time_type} onChange={(e) => set("work_time_type", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                      <option value="full_time">Temps plein</option>
                      <option value="part_time">Temps partiel</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mode de paie</Label>
                    <select value={form.pay_mode} onChange={(e) => set("pay_mode", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                      <option value="monthly_salary">Salaire mensuel</option>
                      <option value="hourly_salary">Salaire horaire</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Durée mensuelle (h)</Label>
                    <Input type="number" step="0.01" value={form.monthly_duration} onChange={(e) => set("monthly_duration", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Durée hebdo (h)</Label>
                    <Input type="number" step="0.5" value={form.weekly_duration} onChange={(e) => set("weekly_duration", e.target.value)} />
                  </div>
                </div>
                {form.pay_mode === "monthly_salary" ? (
                  <div className="space-y-1.5">
                    <Label>Salaire mensuel (€)</Label>
                    <Input type="number" step="0.01" value={form.monthly_salary} onChange={(e) => set("monthly_salary", e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Taux horaire (€/h)</Label>
                    <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => set("hourly_rate", e.target.value)} />
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="km" className="mt-3">
              <Card><CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Barème inter-vacations (entre clients).
                  Le premier trajet domicile→1ʳᵉ intervention n'est jamais comptabilisé.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Inter-vacation (€/km)</Label>
                    <Input type="number" step="0.01" value={form.km_rate_inter_vacation} onChange={(e) => set("km_rate_inter_vacation", e.target.value)} />
                  </div>
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="payroll" className="mt-3">
              <Card><CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Statut</Label>
                    <select value={form.employee_status} onChange={(e) => set("employee_status", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                      <option value="non_cadre">Non-cadre</option>
                      <option value="cadre">Cadre</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Zone géographique</Label>
                    <select value={form.geographic_zone} onChange={(e) => set("geographic_zone", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                      <option value="france_metro">France métropolitaine</option>
                      <option value="alsace_moselle">Alsace-Moselle</option>
                      <option value="dom">DOM</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Commentaire</Label>
                  <Textarea rows={3} value={form.comment} onChange={(e) => set("comment", e.target.value)} />
                </div>
              </CardContent></Card>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Création…" : "Créer le contrat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
