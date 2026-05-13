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
import { useCreateInterventionException } from "@/hooks/use-payments";
import { toast } from "sonner";
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
import { Sparkles, Map as MapIcon } from "lucide-react";
import { MatchingSuggestionsDialog } from "@/components/MatchingSuggestionsDialog";
import { EventTooltip } from "./EventTooltip";
import { LongAbsenceBanner } from "./LongAbsenceBanner";
import { ContractSummaryPanel } from "./ContractSummaryPanel";
import { ContextMenuPlanning } from "./ContextMenuPlanning";
import { ContextMenuEvent } from "./ContextMenuEvent";
import { TripSummaryPanel } from "./TripSummaryPanel";
import { AvailableEmployeesMap } from "./AvailableEmployeesMap";
import { EditInterventionDialog } from "./EditInterventionDialog";

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

/**
 * Convertit une Date JS en ISO local "YYYY-MM-DDTHH:MM:SS" SANS suffixe Z.
 *
 * Pourquoi : `Date.prototype.toISOString()` retourne toujours en UTC.
 * Si on envoie "13:00:00Z" pour représenter 15h Paris, le backend Laravel
 * stocke la chaîne naïve "2026-05-13 13:00:00" (perte du TZ → SQLite ne le
 * conserve pas), puis le cast 'datetime' relit cette valeur en supposant
 * la TZ de l'app (Paris) → on obtient 13h Paris au lieu de 15h Paris.
 *
 * En envoyant directement "2026-05-13T15:00:00" sans TZ, Carbon parse en
 * timezone applicative (Paris) et le round-trip reste correct.
 */
function localISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const STATUS_LABELS: Record<string, string> = {
  a_pourvoir: "À pourvoir",
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
  draft: "Brouillon",
  terminated: "Terminée",
};

/**
 * Couleur stable par employee_id — palette saturée mais cohérente avec
 * la marque Aspha (vert + bleu ciel dominants). 12 couleurs distinctes.
 */
const EMPLOYEE_PALETTE = [
  "#10b981", // emerald (signature Aspha)
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#a855f7", // purple
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#22c55e", // green
];
function colorForEmployee(employeeId: number | null | undefined): string {
  if (!employeeId) return "#94a3b8";  // slate pour "à pourvoir"
  return EMPLOYEE_PALETTE[employeeId % EMPLOYEE_PALETTE.length];
}

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
  const [matchingOpen, setMatchingOpen] = useState(false);
  // État pour le tooltip hover sur les events
  const [hover, setHover] = useState<{ ev: any; x: number; y: number } | null>(null);
  // Menu contextuel clic droit — peut cibler un slot vide OU un event existant
  const [ctxMenu, setCtxMenu] = useState<
    | { kind: "slot"; x: number; y: number; date: Date }
    | { kind: "event"; x: number; y: number; intervention: any }
    | null
  >(null);
  // Mode création pré-rempli (ponctuel / récurrent / absence / indisponibilité)
  const [createMode, setCreateMode] = useState<"ponctuel" | "recurrent" | "absence" | "indispo">("ponctuel");

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
  const createException = useCreateInterventionException();

  // Events sont des occurrences expansées (1 event = 1 RDV concret, même pour les récurrentes)
  const events: EventInput[] = useMemo(() => (interventions.data ?? []).map((ev) => {
    const employeeName = ev.employee?.name ?? "À pourvoir";
    const clientLabel = ev.client?.company_name ?? ev.client?.code ?? "?";
    // Le titre est volontairement court ; l'event content riche fait le reste.
    return {
      id: ev.id,
      title: `${clientLabel}\n${employeeName}`,
      start: ev.start_datetime,
      end: ev.end_datetime,
      backgroundColor: ev.status === "annulee"
        ? "#ef4444"
        : colorForEmployee(ev.employee?.id),
      borderColor: ev.status === "realisee" ? "#10b981" : "transparent",
      textColor: "#ffffff",
      classNames: [
        ev.status === "annulee" ? "intervention-cancelled" : "",
        ev.status === "realisee" ? "intervention-done" : "",
        ev.is_recurring ? "intervention-recurring" : "",
      ].filter(Boolean),
      editable: true,
      extendedProps: { intervention: ev },
    };
  }), [interventions.data]);

  const handleDatesSet = (arg: DatesSetArg) => {
    setWindow({ from: fmt(arg.start), to: fmt(arg.end) });
  };

  const handleEventDrop = (arg: EventDropArg | EventResizeDoneArg) => {
    const ev = arg.event.extendedProps.intervention;
    if (!ev || !arg.event.start || !arg.event.end) return;

    // CRITICAL : on envoie en local naïf (sans Z) pour que Carbon backend
    // parse en TZ applicative (Paris). Sinon on perd 2h sur le round-trip
    // (cf. localISO doc plus haut).
    const startLocal = localISO(arg.event.start);
    const endLocal = localISO(arg.event.end);

    // Cas 1 : occurrence virtuelle d'une récurrence → on crée une exception
    if (ev.is_occurrence) {
      // Recalcule occurrence_date depuis la NOUVELLE start (sinon l'exception
      // se lie à l'ancienne date et n'efface pas la bonne occurrence).
      const newOccurrenceDate = arg.event.start.toLocaleDateString("sv-SE");  // YYYY-MM-DD local
      createException.mutate({
        parentId: ev.intervention_id,
        payload: {
          exception_date: newOccurrenceDate,
          start_datetime: startLocal,
          end_datetime: endLocal,
          status: ev.status ?? "planifiee",
        },
      }, {
        onSuccess: () => toast.success("Occurrence déplacée (exception créée sur la série)"),
        onError: (e: any) => {
          toast.error(e?.response?.data?.message ?? "Impossible de déplacer cette occurrence");
          arg.revert();
        },
      });
      return;
    }

    // Cas 2 : intervention ponctuelle ou exception → update direct
    update.mutate({
      id: ev.intervention_id,
      patch: {
        start_datetime: startLocal as any,
        end_datetime: endLocal as any,
      },
    }, {
      onSuccess: () => toast.success(ev.is_exception ? "Exception déplacée" : "Intervention déplacée"),
      onError: () => arg.revert(),
    });
  };

  // Toggle facturation/paiement depuis le hover popover
  const toggleFlag = (interventionId: number, field: "bill_client" | "is_paid", value: boolean) => {
    update.mutate({ id: interventionId, patch: { [field]: value } as any }, {
      onSuccess: () => toast.success("Mis à jour"),
      onError: (e: any) => toast.error(e?.response?.data?.message ?? "Erreur"),
    });
  };

  const handleEventClick = (arg: EventClickArg) => {
    setSelected(arg.event.extendedProps.intervention);
  };

  const handleSelect = (arg: DateSelectArg) => {
    setSelectedDate(arg.start);
    setCreateMode("ponctuel");
    setCreateOpen(true);
    arg.view.calendar.unselect();
  };

  // Clic droit : détecte si on cible un EVENT existant ou un SLOT vide
  // (FullCalendar n'a pas de hook dédié → event delegation sur le wrapper)
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHover(null);  // ferme le tooltip hover pour ne pas qu'il reste derrière le menu
    const target = e.target as HTMLElement;

    // 1. Clic sur un event existant ?
    const eventEl = target.closest(".fc-event") as HTMLElement | null;
    if (eventEl) {
      // FullCalendar n'expose pas l'event via data attribute directement,
      // on retrouve via l'index dans le DOM ordering (méthode fragile mais simple).
      // Plus robuste : extraire l'id depuis l'attribut "fcSeg" exposé dans __seg, ou retrouver
      // l'event par sa position. Ici on lit l'innertext pour matcher via le titre (suffisant
      // pour MVP — sinon FullCalendar's getEventById si on conserve l'id).
      // Approche pragmatique : on déclenche un click natif pour que FullCalendar nous file l'event
      // via son propre handler `eventClick`. À la place on lit directement extendedProps via
      // ce qu'on a stocké dans hover ou on retrouve par data-fc-event.
      // Le plus simple : on prend l'event sous la souris depuis le state `hover` (déjà setup au mouseenter).
      if (hover?.ev) {
        setCtxMenu({ kind: "event", x: e.clientX, y: e.clientY, intervention: hover.ev });
        return;
      }
    }

    // 2. Sinon, clic sur un slot vide → menu "créer"
    const slot = target.closest("[data-time], [data-date]") as HTMLElement | null;
    let clickDate = new Date();
    if (slot) {
      const dateAttr = slot.getAttribute("data-date");
      const timeAttr = slot.getAttribute("data-time");
      if (dateAttr) clickDate = new Date(dateAttr + (timeAttr ? `T${timeAttr}` : "T09:00:00"));
    }
    setCtxMenu({ kind: "slot", x: e.clientX, y: e.clientY, date: clickDate });
  };

  const handleCtxAction = (mode: "ponctuel" | "recurrent" | "absence" | "indispo") => {
    if (!ctxMenu || ctxMenu.kind !== "slot") return;
    setSelectedDate(ctxMenu.date);
    setCreateMode(mode);
    setCreateOpen(true);
  };

  // Actions du menu contextuel sur un event existant
  const handleCtxEventAction = (action: "edit" | "match" | "delete" | "cancel") => {
    if (!ctxMenu || ctxMenu.kind !== "event") return;
    const iv = ctxMenu.intervention;
    setCtxMenu(null);
    if (action === "edit") {
      setSelected(iv);
    } else if (action === "match") {
      setSelected(iv);
      setMatchingOpen(true);
    } else if (action === "delete") {
      if (confirm(iv.is_occurrence
        ? "Supprimer toute la série de récurrences ?"
        : "Supprimer cette intervention ?")) {
        del.mutate(iv.intervention_id);
      }
    } else if (action === "cancel") {
      update.mutate({ id: iv.intervention_id, patch: { status: "annulee" } as any }, {
        onSuccess: () => toast.success("Intervention annulée"),
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Planning"
        description="Interventions ponctuelles et récurrentes — drag-and-drop pour déplacer"
        actions={
          <Button onClick={() => { setSelectedDate(undefined); setCreateMode("ponctuel"); setCreateOpen(true); }}>
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
        <div className="ml-auto text-xs text-muted-foreground">
          Clic droit sur le calendrier pour créer rapidement
        </div>
      </div>

      {/* Bandeau absences longue durée */}
      <LongAbsenceBanner from={window.from} to={window.to} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
      <div className="rounded-md border bg-card p-3" onContextMenu={handleContextMenu}>
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
          slotDuration="00:15:00"
          snapDuration="00:05:00"
          allDaySlot={false}
          nowIndicator
          height="75vh"
          datesSet={handleDatesSet}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          eventClick={handleEventClick}
          select={handleSelect}
          eventMouseEnter={(arg) => {
            const rect = (arg.el as HTMLElement).getBoundingClientRect();
            setHover({ ev: arg.event.extendedProps.intervention, x: rect.right + 8, y: rect.top });
          }}
          eventMouseLeave={() => setHover(null)}
          eventContent={(arg) => {
            const iv = arg.event.extendedProps.intervention;
            const start = new Date(iv.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const end = new Date(iv.end_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            // Affichage badge "✓ Pointé" si checkin présent
            let badgeNode: React.ReactNode = null;
            if (iv.checkin?.checkin_time) {
              const badged = new Date(iv.checkin.checkin_time);
              const planned = new Date(iv.start_datetime);
              const lateMin = Math.round((badged.getTime() - planned.getTime()) / 60000);
              const lateOK = lateMin <= 5;
              const badgeTime = badged.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              badgeNode = (
                <div className={`text-[9px] mt-0.5 font-medium ${lateOK ? "text-emerald-200" : "text-orange-200"}`}>
                  ✓ Pointé {badgeTime}
                  {lateMin > 0 && ` (+${lateMin} min)`}
                </div>
              );
            }
            return (
              <div className="leading-tight overflow-hidden text-[11px] px-0.5 py-px">
                <div className="flex items-center gap-1 font-semibold">
                  {iv.is_recurring && <span>🔁</span>}
                  <span className="truncate">
                    {iv.client?.company_name ?? iv.client?.code ?? "?"}
                  </span>
                </div>
                <div className="truncate opacity-90 font-medium">
                  {iv.employee?.name ?? "À pourvoir"}
                </div>
                <div className="opacity-75 text-[10px]">{start}–{end}</div>
                {badgeNode}
              </div>
            );
          }}
        />
      </div>

      {/* Panneau latéral : suivi contrats + trajets */}
      <div className="space-y-3">
        <ContractSummaryPanel
          from={window.from}
          to={window.to}
          employeeFilter={employeeFilter}
        />
        <TripSummaryPanel
          from={window.from}
          to={window.to}
          employeeFilter={employeeFilter}
        />
      </div>
      </div>

      {/* Création */}
      <CreateInterventionDialog
        open={createOpen}
        defaultDate={selectedDate}
        mode={createMode}
        onClose={() => setCreateOpen(false)}
        clients={clients}
        employees={employees}
      />

      {/* Menu contextuel clic droit */}
      {ctxMenu?.kind === "slot" && (
        <ContextMenuPlanning
          x={ctxMenu.x}
          y={ctxMenu.y}
          date={ctxMenu.date}
          onAction={handleCtxAction}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {ctxMenu?.kind === "event" && (
        <ContextMenuEvent
          x={ctxMenu.x}
          y={ctxMenu.y}
          intervention={ctxMenu.intervention}
          onAction={handleCtxEventAction}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Édition RDV sélectionné */}
      {selected && (
        <EditInterventionDialog
          intervention={selected}
          employees={employees}
          onClose={() => setSelected(null)}
          onSuggest={() => setMatchingOpen(true)}
          onDeleted={() => setSelected(null)}
        />
      )}

      <MatchingSuggestionsDialog
        interventionId={selected?.intervention_id ?? null}
        open={matchingOpen}
        onClose={() => setMatchingOpen(false)}
        onAssigned={() => { setSelected(null); interventions.refetch(); }}
      />

      {hover && (
        <EventTooltip
          ev={hover.ev}
          x={hover.x}
          y={hover.y}
          onToggle={(field, value) => toggleFlag(hover.ev.intervention_id, field, value)}
        />
      )}
    </div>
  );
}

function CreateInterventionDialog({ open, defaultDate, mode, onClose, clients, employees }: {
  open: boolean;
  defaultDate?: Date;
  mode: "ponctuel" | "recurrent" | "absence" | "indispo";
  onClose: () => void;
  clients: any[];
  employees: any[];
}) {
  const create = useCreateIntervention();
  const initialDate = (defaultDate ?? new Date()).toISOString().slice(0, 10);
  const initialTime = (defaultDate ?? new Date()).toTimeString().slice(0, 5);
  const isRecurring = mode === "recurrent";
  const isAbsence = mode === "absence";
  const isIndispo = mode === "indispo";
  const [mapMode, setMapMode] = useState(false);
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
    // Absence/Indispo
    absence_start_date: initialDate,
    absence_end_date: initialDate,
    absence_reason: "",
  });

  // Reset le form quand le mode change (pour qu'on parte sur du frais)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // → on garde simple : le user clique soit "ponctuel" soit "recurrent" et ça refait un render

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAbsence) {
      if (!form.employee_id) { toast.error("Choisis un intervenant"); return; }
      // POST /employees/{id}/absences
      const { api } = await import("@/lib/api");
      await api.post(`/employees/${form.employee_id}/absences`, {
        start_date: form.absence_start_date,
        end_date: form.absence_end_date,
        reason: form.absence_reason || null,
        comment: form.comment || null,
      });
      toast.success("Absence enregistrée");
      onClose();
      return;
    }

    if (isIndispo) {
      if (!form.client_id) { toast.error("Choisis un client"); return; }
      const { api } = await import("@/lib/api");
      await api.post(`/clients/${form.client_id}/absences`, {
        start_date: form.absence_start_date,
        end_date: form.absence_end_date,
        reason: form.absence_reason || null,
        comment: form.comment || null,
      });
      toast.success("Indisponibilité client enregistrée");
      onClose();
      return;
    }

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

  const title = isAbsence ? "Nouvelle absence intervenant"
    : isIndispo ? "Nouvelle indisponibilité client"
    : isRecurring ? "Nouvelle intervention récurrente"
    : "Nouvelle intervention ponctuelle";

  // Cas absence/indispo : formulaire simplifié
  if (isAbsence || isIndispo) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {isAbsence && (
              <div className="space-y-1.5">
                <Label>Intervenant *</Label>
                <select value={form.employee_id} onChange={(e) => setForm((f: any) => ({ ...f, employee_id: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
                  <option value="">— Choisir —</option>
                  {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>
            )}
            {isIndispo && (
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <select value={form.client_id} onChange={(e) => setForm((f: any) => ({ ...f, client_id: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
                  <option value="">— Choisir —</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Du *</Label>
                <Input type="date" value={form.absence_start_date} onChange={(e) => setForm((f: any) => ({ ...f, absence_start_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Au *</Label>
                <Input type="date" value={form.absence_end_date} onChange={(e) => setForm((f: any) => ({ ...f, absence_end_date: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Input value={form.absence_reason} onChange={(e) => setForm((f: any) => ({ ...f, absence_reason: e.target.value }))} placeholder={isAbsence ? "Congés, maladie, formation…" : "Vacances client, hospitalisation…"} />
            </div>
            <div className="space-y-1.5">
              <Label>Commentaire</Label>
              <Input value={form.comment} onChange={(e) => setForm((f: any) => ({ ...f, comment: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={mapMode ? "sm:max-w-4xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {mapMode && form.client_id && form.start_datetime && form.end_datetime ? (
          <>
            <AvailableEmployeesMap
              startDatetime={form.start_datetime}
              endDatetime={form.end_datetime}
              clientId={parseInt(form.client_id, 10)}
              onAssign={(empId) => {
                setForm((f: any) => ({ ...f, employee_id: String(empId) }));
                setMapMode(false);
              }}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMapMode(false)}>
                Retour au formulaire
              </Button>
            </DialogFooter>
          </>
        ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <select value={form.client_id} onChange={(e) => setForm((f: any) => ({ ...f, client_id: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" required>
              <option value="">— Choisir —</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center justify-between">
              <span>Intervenant (optionnel)</span>
              {form.client_id && form.start_datetime && form.end_datetime && !isRecurring && (
                <button type="button" onClick={() => setMapMode(true)}
                  className="text-[10px] text-primary hover:underline inline-flex items-center gap-1">
                  <MapIcon className="h-3 w-3" />
                  Voir sur la carte
                </button>
              )}
            </Label>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
