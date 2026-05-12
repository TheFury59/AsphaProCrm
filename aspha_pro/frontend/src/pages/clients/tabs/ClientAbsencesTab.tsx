import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useClientAbsences, useCreateClientAbsence, useDeleteClientAbsence,
  useClientAbsenceReasons,
} from "@/hooks/use-sub-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function ClientAbsencesTab({ clientId }: { clientId: number }) {
  const { data: list = [] } = useClientAbsences(clientId);
  const { data: reasons = [] } = useClientAbsenceReasons();
  const create = useCreateClientAbsence(clientId);
  const del = useDeleteClientAbsence(clientId);
  const [open, setOpen] = useState(false);
  const [isPeriodic, setIsPeriodic] = useState(false);
  const [form, setForm] = useState<any>({
    reason_id: "",
    is_periodic: false,
    is_hourly: false,
    start_datetime: "",
    duration_hours: "",
    start_date: "",
    end_date: "",
    start_time: "09:00",
    end_time: "17:00",
    frequency: "weekly",
    comment: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...form,
      is_periodic: isPeriodic,
      reason_id: parseInt(form.reason_id, 10),
      duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : undefined,
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Absences client</CardTitle>
          <CardDescription>Ponctuelles + périodiques fusionnées</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune absence enregistrée.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((a) => (
              <li key={a.id} className="flex items-start justify-between border rounded p-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{a.reason?.label ?? "—"}</Badge>
                    {a.is_periodic ? <Badge variant="secondary">Périodique</Badge> : <Badge variant="secondary">Ponctuelle</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.is_periodic
                      ? `Du ${a.start_date ?? "?"} au ${a.end_date ?? "—"} · ${a.frequency} · ${a.start_time}-${a.end_time}`
                      : `${a.start_datetime ?? "—"} · ${a.duration_hours ?? "?"} h`}
                  </div>
                  {a.comment && <div className="text-xs mt-1">{a.comment}</div>}
                </div>
                <button onClick={() => del.mutate(a.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle absence</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <select value={form.reason_id} onChange={(e) => setForm((f: any) => ({ ...f, reason_id: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
                <option value="">— Choisir —</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setIsPeriodic(false)}
                className={`flex-1 rounded border px-3 py-1.5 text-sm ${!isPeriodic ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"}`}>
                Ponctuelle
              </button>
              <button type="button" onClick={() => setIsPeriodic(true)}
                className={`flex-1 rounded border px-3 py-1.5 text-sm ${isPeriodic ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"}`}>
                Périodique
              </button>
            </div>

            {!isPeriodic ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date et heure</Label>
                  <Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm((f: any) => ({ ...f, start_datetime: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Durée (h)</Label>
                  <Input type="number" step="0.5" min="0.5" value={form.duration_hours} onChange={(e) => setForm((f: any) => ({ ...f, duration_hours: e.target.value }))} required />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date début</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, start_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date fin (optionnelle)</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm((f: any) => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>De</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm((f: any) => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>À</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm((f: any) => ({ ...f, end_time: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fréquence</Label>
                    <select value={form.frequency} onChange={(e) => setForm((f: any) => ({ ...f, frequency: e.target.value }))}
                      className="w-full rounded-md border bg-background px-2 py-2 text-sm h-9">
                      <option value="daily">Quotidienne</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuelle</option>
                      <option value="yearly">Annuelle</option>
                    </select>
                  </div>
                </div>
              </>
            )}

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
