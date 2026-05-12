import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useEmployeeTrainings, useCreateTraining, useDeleteTraining,
} from "@/hooks/use-sub-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function EmployeeTrainingsTab({ employeeId }: { employeeId: number }) {
  const { data: list = [] } = useEmployeeTrainings(employeeId);
  const create = useCreateTraining(employeeId);
  const del = useDeleteTraining(employeeId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    training_phase: "onboarding",
    title: "",
    training_center: "",
    start_date: "",
    end_date: "",
    hours_count: "",
    trainer: "",
    is_paid: true,
    comment: "",
  });

  const onboarding = list.filter((t) => t.training_phase === "onboarding");
  const ongoing = list.filter((t) => t.training_phase === "ongoing");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...form,
      hours_count: form.hours_count ? parseFloat(form.hours_count) : undefined,
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Formations</CardTitle>
          <CardDescription>À l'entrée dans l'entreprise + en cours d'emploi</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="onboarding">
          <TabsList>
            <TabsTrigger value="onboarding">Entrée entreprise ({onboarding.length})</TabsTrigger>
            <TabsTrigger value="ongoing">En cours ({ongoing.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="onboarding" className="mt-3">
            <TrainingList items={onboarding} onDelete={(id) => del.mutate(id)} />
          </TabsContent>
          <TabsContent value="ongoing" className="mt-3">
            <TrainingList items={ongoing} onDelete={(id) => del.mutate(id)} />
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <select value={form.training_phase} onChange={(e) => setForm((f: any) => ({ ...f, training_phase: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                  <option value="onboarding">Entrée entreprise</option>
                  <option value="ongoing">En cours d'emploi</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Heures</Label>
                <Input type="number" step="0.5" min="0" value={form.hours_count} onChange={(e) => setForm((f: any) => ({ ...f, hours_count: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Centre</Label>
                <Input value={form.training_center} onChange={(e) => setForm((f: any) => ({ ...f, training_center: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Formateur</Label>
                <Input value={form.trainer} onChange={(e) => setForm((f: any) => ({ ...f, trainer: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f: any) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_paid} onChange={(e) => setForm((f: any) => ({ ...f, is_paid: e.target.checked }))} />
              Rémunérée
            </label>
            <div className="space-y-1.5">
              <Label>Commentaire</Label>
              <Textarea rows={2} value={form.comment} onChange={(e) => setForm((f: any) => ({ ...f, comment: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TrainingList({ items, onDelete }: { items: any[]; onDelete: (id: number) => void }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune formation dans cette phase.</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {items.map((t) => (
        <li key={t.id} className="flex items-start justify-between border rounded p-2">
          <div>
            <div className="font-medium">{t.title}</div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
              {t.training_center && <span>📍 {t.training_center}</span>}
              {t.trainer && <span>🎓 {t.trainer}</span>}
              {t.hours_count && <span>⏱ {t.hours_count}h</span>}
              {t.start_date && <span>📅 {t.start_date}{t.end_date ? ` → ${t.end_date}` : ""}</span>}
              {t.is_paid && <Badge variant="outline" className="text-xs">Rémunérée</Badge>}
            </div>
            {t.comment && <div className="text-xs mt-1 italic">{t.comment}</div>}
          </div>
          <button onClick={() => onDelete(t.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
