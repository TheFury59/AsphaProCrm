import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { DatesSetArg, DateSelectArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useAppointments, useClients, useDeleteAppointment, useEmployees, useUpdateAppointment } from "@/hooks/use-planning";
import { ContractStatusPanel } from "@/components/ContractStatusPanel";
import { AppointmentTooltip } from "@/components/AppointmentTooltip";
import { CreateAppointmentDialog } from "@/components/CreateAppointmentDialog";
import type { Appointment, Employee } from "@/types/api";
import { Plus, Trash2 } from "lucide-react";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CalendarPage() {
  const calendarRef = useRef<FullCalendar | null>(null);

  // Date window currently displayed (set by FullCalendar via datesSet)
  const [window, setWindow] = useState(() => ({
    from: fmtDate(new Date(new Date().setHours(0, 0, 0, 0))),
    to: fmtDate(new Date(new Date().setDate(new Date().getDate() + 7))),
  }));

  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  const [clientFilter, setClientFilter] = useState<number | null>(null);
  const [hovered, setHovered] = useState<{ appt: Appointment; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<Date | undefined>();

  const { data: employees = [] } = useEmployees();
  const { data: clients = [] } = useClients();
  const { data: appointments = [], isLoading } = useAppointments({
    from: window.from,
    to: window.to,
    employee_id: employeeFilter,
    client_id: clientFilter,
  });
  const updateAppt = useUpdateAppointment();
  const deleteAppt = useDeleteAppointment();

  const events: EventInput[] = useMemo(() => appointments.map((a) => ({
    id: String(a.id),
    title: `${a.client?.display_name ?? "—"} — ${a.service?.name ?? ""}${a.employee ? ` (${a.employee.full_name.split(" ")[0]})` : ""}`,
    start: a.scheduled_start,
    end: a.scheduled_end,
    backgroundColor: a.service?.color ?? "#3b82f6",
    borderColor: a.service?.color ?? "#3b82f6",
    extendedProps: { appointment: a },
    classNames: a.status === "cancelled" ? ["opacity-50", "line-through"] : [],
  })), [appointments]);

  const handleDatesSet = (arg: DatesSetArg) => {
    setWindow({
      from: fmtDate(arg.start),
      to: fmtDate(arg.end),
    });
  };

  const persistMove = async (arg: EventDropArg | EventResizeDoneArg) => {
    const id = Number(arg.event.id);
    if (!arg.event.start || !arg.event.end) return;
    try {
      await updateAppt.mutateAsync({
        id,
        patch: {
          scheduled_start: arg.event.start.toISOString(),
          scheduled_end: arg.event.end.toISOString(),
        },
      });
    } catch {
      arg.revert();
    }
  };

  const handleEventDrop = (arg: EventDropArg) => { void persistMove(arg); };
  const handleEventResize = (arg: EventResizeDoneArg) => { void persistMove(arg); };

  const handleEventClick = (arg: EventClickArg) => {
    const a = arg.event.extendedProps.appointment as Appointment;
    setSelected(a);
  };

  const handleEventMouseEnter = (arg: { event: { extendedProps: { appointment?: Appointment } }; jsEvent: MouseEvent }) => {
    const a = arg.event.extendedProps.appointment;
    if (!a) return;
    setHovered({ appt: a, x: arg.jsEvent.clientX, y: arg.jsEvent.clientY });
  };

  const handleEventMouseLeave = () => setHovered(null);

  const handleSelect = (arg: DateSelectArg) => {
    setCreateDefaultDate(arg.start);
    setCreateOpen(true);
    arg.view.calendar.unselect();
  };

  const selectedEmployee: Employee | null = useMemo(
    () => employees.find((e) => e.id === employeeFilter) ?? null,
    [employees, employeeFilter]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-3">
        {/* Toolbar de filtres */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Intervenant</label>
            <select
              value={employeeFilter ?? ""}
              onChange={(e) => setEmployeeFilter(e.target.value ? Number(e.target.value) : null)}
              className="input w-48"
            >
              <option value="">Tous</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Client</label>
            <select
              value={clientFilter ?? ""}
              onChange={(e) => setClientFilter(e.target.value ? Number(e.target.value) : null)}
              className="input w-48"
            >
              <option value="">Tous</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setCreateDefaultDate(undefined); setCreateOpen(true); }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nouvelle intervention
          </button>
        </div>

        {/* Calendrier */}
        <div className="rounded-md border bg-card p-2 relative">
          {isLoading && (
            <div className="absolute top-2 right-2 z-10 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              Chargement…
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="timeGridWeek"
            locale={frLocale}
            timeZone="local"
            firstDay={1}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
            }}
            buttonText={{
              today: "Aujourd'hui",
              day: "Jour",
              week: "Semaine",
              month: "Mois",
              list: "Liste",
            }}
            events={events}
            editable
            selectable
            selectMirror
            droppable={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            allDaySlot={false}
            nowIndicator
            height="75vh"
            datesSet={handleDatesSet}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventMouseEnter={handleEventMouseEnter}
            eventMouseLeave={handleEventMouseLeave}
            select={handleSelect}
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-3">
        <ContractStatusPanel
          employee={selectedEmployee}
          from={window.from}
          to={window.to}
        />

        {selected && (
          <SelectedAppointmentPanel
            appointment={selected}
            onClose={() => setSelected(null)}
            onDelete={async () => {
              if (!confirm("Supprimer cette intervention ?")) return;
              await deleteAppt.mutateAsync(selected.id);
              setSelected(null);
            }}
          />
        )}
      </aside>

      {/* Tooltip flottant au survol */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: hovered.y + 12, left: hovered.x + 12 }}
        >
          <AppointmentTooltip appointment={hovered.appt} />
        </div>
      )}

      <CreateAppointmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultDate={createDefaultDate}
      />
    </div>
  );
}

function SelectedAppointmentPanel({
  appointment,
  onClose,
  onDelete,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateAppointment();
  return (
    <div className="rounded-md border p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold">RDV sélectionné</div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
      </div>
      <AppointmentTooltip appointment={appointment} />
      <div className="space-y-2 pt-2 border-t">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={appointment.paid_to_employee}
            onChange={(e) => update.mutate({ id: appointment.id, patch: { paid_to_employee: e.target.checked } })}
          />
          Payé intervenant
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={appointment.invoiced_to_client}
            onChange={(e) => update.mutate({ id: appointment.id, patch: { invoiced_to_client: e.target.checked } })}
          />
          Facturé client
        </label>
        <select
          value={appointment.status}
          onChange={(e) => update.mutate({ id: appointment.id, patch: { status: e.target.value as Appointment["status"] } })}
          className="input text-xs"
        >
          <option value="planned">Planifié</option>
          <option value="done">Terminé</option>
          <option value="cancelled">Annulé</option>
          <option value="no_show">Absent</option>
        </select>
        <button
          onClick={onDelete}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/50 text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer ce RDV
        </button>
      </div>
    </div>
  );
}
