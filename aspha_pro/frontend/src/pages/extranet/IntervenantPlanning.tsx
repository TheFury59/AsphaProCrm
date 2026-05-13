import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import { Card } from "@/components/ui/card";
import { useIntervenantPlanning } from "@/hooks/use-extranet";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Planning de l'intervenant en lecture seule (pas d'édition).
 * Vue par défaut : semaine.
 */
export function IntervenantPlanning() {
  const [window, setWindow] = useState(() => ({
    from: fmt(new Date(new Date().setHours(0, 0, 0, 0))),
    to: fmt(new Date(new Date().setDate(new Date().getDate() + 14))),
  }));
  const { data } = useIntervenantPlanning({ from: window.from, to: window.to });

  const events: EventInput[] = (data ?? []).map((ev: any) => ({
    id: ev.id,
    title: `${ev.client?.company_name ?? ev.client?.code ?? "?"}\n${ev.start_time ?? ""}`,
    start: ev.start_datetime,
    end: ev.end_datetime,
    backgroundColor: ev.status === "realisee" ? "#10b981" : ev.status === "annulee" ? "#ef4444" : "#6366f1",
    borderColor: "transparent",
    extendedProps: { intervention: ev },
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Mon planning</h1>
      <Card className="p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView="timeGridWeek"
          locale={frLocale}
          firstDay={1}
          timeZone="local"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,listWeek",
          }}
          buttonText={{ today: "Aujourd'hui", day: "Jour", week: "Semaine", list: "Liste" }}
          events={events}
          editable={false}
          selectable={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          allDaySlot={false}
          nowIndicator
          height="70vh"
          datesSet={(arg: DatesSetArg) => setWindow({ from: fmt(arg.start), to: fmt(arg.end) })}
        />
      </Card>
    </div>
  );
}
