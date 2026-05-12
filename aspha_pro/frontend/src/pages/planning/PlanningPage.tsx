import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { DateSelectArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useInterventions, useUpdateIntervention, useCreateIntervention, useDeleteIntervention } from "@/hooks/use-phase3";
import { useEmployees } from "@/hooks/use-employees";
import { useClients } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

const STATUS_LABELS: Record<string, string> = {
  a_pourvoir: "À pourvoir",
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
  draft: "Brouillon",
  terminated: "Terminée",
};

export function PlanningPage() {
  const [window, setWindow] = useState(() => ({
    from: fmt(new Date(new Date().setHours(0, 0, 0, 0))),
    to: fmt(new Date(new Date().setDate(new Date().getDate() + 14))),
  }));
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  const [clientFilter, setClientFilter] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selected, setSelected] = useState<any>(null);

  const { data: employeesData } = useEmployees({ per_page: 100 });
  const { data: clientsData } = useClients({ per_page: 100 });
  const employees = employeesData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const interventions = useInterventions({
    from: window.from,
    to: window.to,
    employee_id: employeeFilter ?? undefined,
    client_id: clientFilter ?? undefined,
  });
  const update = useUpdateIntervention();
  const del = useDeleteIntervention();

  const events: EventInput[] = useMemo(() => (interventions.data ?? []).map((i: any) => {
    if (i.is_recurring) {
      // Pour MVP : afficher juste le premier RDV (date_start + start_time)
      // (matérialisation complète des RRULE à venir)
      const date = i.recurrence_start_date ?? new Date().toISOString().slice(0, 10);
      const start = i.start_time ? `${date}T${i.start_time}` : date;
      const end = i.end_time ? `${date}T${i.end_time}` : start;
      return {
        id: String(i.id),
        title: `🔁 ${i.client?.code ?? "?"} ${i.employee?.name ? `· ${i.employee.name}` : ""}`,
        start, end,
        backgroundColor: "#8b5cf6",
        extendedProps: { intervention: i },
      };
    }
    return {
      id: String(i.id),
      title: `${i.client?.code ?? "?"} ${i.employee?.name ? `· ${i.employee.name}` : ""}`,
      start: i.start_datetime,
      end: i.end_datetime,
      backgroundColor: i.status === "realisee" ? "#10b981" : i.status === "annulee" ? "#ef4444" : "#3b82f6",
      extendedProps: { intervention: i },
    };
  }), [interventions.data]);

  const handleDatesSet = (arg: DatesSetArg) => {
    setWindow({ from: fmt(arg.start), to: fmt(arg.end) });
  };

  const handleEventDrop = (arg: EventDropArg | EventResizeDoneArg) => {
    const id = Number(arg.event.id);
    if (!arg.event.start || !arg.event.end) return;
    update.mutate({
      id,
      patch: {
        start_datetime: arg.event.start.toISOString(),
        end_datetime: arg.event.end.toISOString(),
      },
    }, {
      onError: () => arg.revert(),
    });
  };

  const handleEventClick = (arg: EventClickArg) => {
    setSelected(arg.event.extendedProps.intervention);
  };

  const handleSelect = (arg: DateSelectArg) => {
    setSelectedDate(arg.start);
    setCreateOpen(true);
    arg.view.calendar.unselect();
  };

  return (
    <div>
      <PageHeader
        title="Planning"
        description="Interventions ponctuelles et récurrentes — drag-and-drop pour déplacer"
        actions={
          <Button onClick={() => { setSelectedDate(undefined); setCreateOpen(true); }}>
            Nouvelle intervention
          </Button>
        }
      />

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-md border bg-card">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Intervenant</Label>
          <select value={employeeFilter ?? ""} onChange={(e) => setEmployeeFilter(e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">Tous</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Client</Label>
          <select value={clientFilter ?? ""} onChange={(e) => setClientFilter(e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">Tous</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-md border bg-card p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="timeGridWeek"
          locale={frLocale}
          firstDay={1}
          timeZone="local"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
          }}
          buttonText={{
            today: "Aujourd'hui", day: "Jour", week: "Semaine", month: "Mois", list: "Liste",
          }}
          events={events}
          editable
          selectable
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          allDaySlot={false}
          nowIndicator
          height="75vh"
          datesSet={handleDatesSet}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          eventClick={handleEventClick}
          select={handleSelect}
        />
      </div>

      {/* Création */}
      <CreateInterventionDialog
        open={createOpen}
        defaultDate={selectedDate}
        onClose={() => setCreateOpen(false)}
        clients={clients}
        employees={employees}
      />

      {/* Détail RDV sélectionné */}
      {selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.client?.code ?? "Intervention"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge>{STATUS_LABELS[selected.status] ?? selected.status}</Badge>
                {selected.is_recurring && <Badge variant="secondary">Récurrente</Badge>}
                {selected.employee && <Badge variant="outline">{selected.employee.name}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {selected.is_recurring
                  ? `Récurrence à partir du ${selected.recurrence_start_date} · ${selected.frequency} · ${selected.start_time}-${selected.end_time}`
                  : `${new Date(selected.start_datetime).toLocaleString("fr-FR")} → ${new Date(selected.end_datetime).toLocaleString("fr-FR")}`}
              </div>
              {selected.comment && <p className="text-sm border-t pt-2">{selected.comment}</p>}
            </div>
            <DialogFooter>
              <Button variant="destructive" size="sm" onClick={async () => { await del.mutateAsync(selected.id); setSelected(null); }}>
                Supprimer
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateInterventionDialog({ open, defaultDate, onClose, clients, employees }: {
  open: boolean;
  defaultDate?: Date;
  onClose: () => void;
  clients: any[];
  employees: any[];
}) {
  const create = useCreateIntervention();
  const initialDate = (defaultDate ?? new Date()).toISOString().slice(0, 10);
  const initialTime = (defaultDate ?? new Date()).toTimeString().slice(0, 5);
  const [isRecurring, setIsRecurring] = useState(false);
  const [form, setForm] = useState<any>({
    client_id: "",
    employee_id: "",
    status: "planifiee",
    start_datetime: `${initialDate}T${initialTime}`,
    end_datetime: `${initialDate}T${initialTime}`,
    recurrence_start_date: initialDate,
    start_time: initialTime,
    end_time: "12:00",
    frequency: "weekly",
    days_of_week: "mon",
    comment: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      client_id: parseInt(form.client_id, 10),
      employee_id: form.employee_id ? parseInt(form.employee_id, 10) : null,
      is_recurring: isRecurring,
      status: form.status,
      comment: form.comment,
    };
    if (isRecurring) {
      Object.assign(payload, {
        recurrence_start_date: form.recurrence_start_date,
        start_time: form.start_time,
        end_time: form.end_time,
        frequency: form.frequency,
        days_of_week: form.days_of_week,
      });
    } else {
      Object.assign(payload, {
        start_datetime: form.start_datetime,
        end_datetime: form.end_datetime,
      });
    }
    await create.mutateAsync(payload);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nouvelle intervention</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsRecurring(false)}
              className={`flex-1 rounded border px-3 py-1.5 text-sm ${!isRecurring ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"}`}>
              Ponctuelle
            </button>
            <button type="button" onClick={() => setIsRecurring(true)}
              className={`flex-1 rounded border px-3 py-1.5 text-sm ${isRecurring ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"}`}>
              Récurrente
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Client *</Label>
            <select value={form.client_id} onChange={(e) => setForm((f: any) => ({ ...f, client_id: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
              <option value="">— Choisir —</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Intervenant (optionnel)</Label>
            <select value={form.employee_id} onChange={(e) => setForm((f: any) => ({ ...f, employee_id: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
              <option value="">À pourvoir</option>
              {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
          </div>

          {!isRecurring ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm((f: any) => ({ ...f, start_datetime: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="datetime-local" value={form.end_datetime} onChange={(e) => setForm((f: any) => ({ ...f, end_datetime: e.target.value }))} required />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date début</Label>
                  <Input type="date" value={form.recurrence_start_date} onChange={(e) => setForm((f: any) => ({ ...f, recurrence_start_date: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Fréquence</Label>
                  <select value={form.frequency} onChange={(e) => setForm((f: any) => ({ ...f, frequency: e.target.value }))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9">
                    <option value="daily">Quotidienne</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuelle</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Heure début</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm((f: any) => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Heure fin</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm((f: any) => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Jours (mon,tue,wed,thu,fri,sat,sun)</Label>
                <Input value={form.days_of_week} onChange={(e) => setForm((f: any) => ({ ...f, days_of_week: e.target.value }))} placeholder="mon,wed,fri" />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Input value={form.comment} onChange={(e) => setForm((f: any) => ({ ...f, comment: e.target.value }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
