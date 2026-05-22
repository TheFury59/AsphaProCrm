import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import { useIntervenantPlanning, useIntervenantProfile } from "@/hooks/use-extranet";
import { EventTooltip } from "@/pages/planning/EventTooltip";
import { ContractSummaryPanel } from "@/pages/planning/ContractSummaryPanel";
import { TripSummaryPanel } from "@/pages/planning/TripSummaryPanel";

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

/**
 * Palette stable employee_id → couleur (alignée sur PlanningPage admin).
 * L'intervenant ne voit que ses propres RDV, donc 1 seule couleur en pratique,
 * mais on garde la même fonction pour cohérence visuelle si jamais des
 * collègues apparaissent dans le futur (ex : trajets partagés).
 */
const EMPLOYEE_PALETTE = [
  "#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4",
  "#84cc16", "#f97316", "#a855f7", "#14b8a6", "#6366f1", "#22c55e",
];
function colorForEmployee(employeeId: number | null | undefined): string {
  if (!employeeId) return "#94a3b8";
  return EMPLOYEE_PALETTE[employeeId % EMPLOYEE_PALETTE.length];
}

/**
 * Vue planning extranet intervanant — composant partagé entre la page d'accueil
 * (`/extranet/intervenant`) et la route dédiée (`/extranet/intervenant/planning`).
 *
 * Contenu : calendrier FullCalendar read-only à gauche + panneaux contrat /
 * trajets empilés sur le côté droit (layout `xl:grid-cols-[1fr_320px]`).
 *
 * Différences avec PlanningPage admin :
 *  - aucun sélecteur d'intervenant/client (filtré server-side sur l'user connecté)
 *  - lecture seule : pas de drag-drop, pas de création, pas de menu contextuel
 *  - employeeFilter forcé sur l'employee_id de l'user connecté pour les panels
 */
export function IntervenantPlanningView() {
  const { data: profile } = useIntervenantProfile();
  const employeeId: number | null = profile?.id ?? null;

  const [window, setWindow] = useState(() => ({
    from: fmt(new Date(new Date().setHours(0, 0, 0, 0))),
    to: fmt(new Date(new Date().setDate(new Date().getDate() + 14))),
  }));

  const { data } = useIntervenantPlanning({ from: window.from, to: window.to });

  // Tooltip hover sur les events (même UX que PlanningPage admin)
  const [hover, setHover] = useState<{ ev: any; x: number; y: number } | null>(null);

  const events: EventInput[] = useMemo(() => (data ?? []).map((ev: any) => {
    const employeeName = ev.employee?.name ?? "À pourvoir";
    const clientLabel = ev.client?.company_name ?? ev.client?.code ?? "?";
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
      editable: false,
      extendedProps: { intervention: ev },
    };
  }), [data]);

  const handleDatesSet = (arg: DatesSetArg) => {
    setWindow({ from: fmt(arg.start), to: fmt(arg.end) });
  };

  return (
    <>
      {/* Calendrier à gauche, panneaux contrat + trajets empilés à droite. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-2xl bg-card shadow-soft p-4 lg:p-5 min-w-0">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
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
            editable={false}
            selectable={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:15:00"
            allDaySlot={false}
            nowIndicator
            height="75vh"
            datesSet={handleDatesSet}
            eventMouseEnter={(arg) => {
              const rect = (arg.el as HTMLElement).getBoundingClientRect();
              setHover({ ev: arg.event.extendedProps.intervention, x: rect.right + 8, y: rect.top });
            }}
            eventMouseLeave={() => setHover(null)}
            eventContent={(arg) => {
              const iv = arg.event.extendedProps.intervention;
              const start = new Date(iv.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const end = new Date(iv.end_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

              // === BADGE BADGEAGE QR (couleur progressive identique admin) ===
              let badgeNode: React.ReactNode = null;
              const now = new Date();
              const startDt = new Date(iv.start_datetime);
              const isFuture = startDt > now;
              const isCancelled = iv.status === "annulee";

              if (iv.checkin?.checkin_time) {
                const badged = new Date(iv.checkin.checkin_time);
                const lateMin = Math.round((badged.getTime() - startDt.getTime()) / 60000);
                const badgeTime = badged.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                const color = lateMin <= 5 ? "bg-emerald-500/90"
                  : lateMin <= 15 ? "bg-orange-500/90"
                  : "bg-red-500/90";
                badgeNode = (
                  <span className={`inline-flex items-center gap-0.5 ${color} text-white text-[9px] px-1 py-px rounded-sm font-semibold`}>
                    ✓ {badgeTime}{lateMin > 0 && ` +${lateMin}`}
                  </span>
                );
              } else if (!isFuture && !isCancelled) {
                badgeNode = (
                  <span className="inline-flex items-center gap-0.5 bg-orange-500/90 text-white text-[9px] px-1 py-px rounded-sm font-semibold">
                    ⚠ Non pointé
                  </span>
                );
              }

              // === BADGE CLÉ ===
              const keyBadge = iv.assigned_key ? (
                <span className="inline-flex items-center justify-center w-4 h-4 bg-emerald-500/90 text-white rounded-sm text-[10px]" title={`Clé assignée : ${iv.assigned_key.label}`}>
                  🔑
                </span>
              ) : iv.client?.has_keys ? (
                <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500/90 text-white rounded-sm text-[10px]" title={`${iv.client.keys_count} clé(s) disponible(s) (aucune assignée)`}>
                  🔑
                </span>
              ) : null;

              const recurringBadge = iv.is_recurring ? (
                <span className="inline-flex items-center justify-center w-4 h-4 bg-violet-500/90 text-white rounded-sm text-[10px]" title="Intervention récurrente">
                  🔁
                </span>
              ) : null;

              const clientLabel = iv.client?.company_name ?? iv.client?.code ?? "?";
              const employeeLabel = iv.employee?.name ?? "À pourvoir";

              return (
                <div className="h-full w-full flex flex-col items-center justify-center text-center overflow-hidden px-1 py-1 gap-0.5">
                  {(keyBadge || recurringBadge) && (
                    <div className="self-end flex items-center gap-0.5 absolute top-0.5 right-0.5">
                      {recurringBadge}
                      {keyBadge}
                    </div>
                  )}
                  <div className="font-bold text-[13px] leading-tight truncate w-full">
                    {clientLabel}
                  </div>
                  <div className="text-[11px] opacity-95 font-medium leading-tight truncate w-full">
                    {employeeLabel}
                  </div>
                  <div className="text-[10px] opacity-80 leading-tight">
                    {start}–{end}
                  </div>
                  {badgeNode && <div className="mt-0.5">{badgeNode}</div>}
                </div>
              );
            }}
          />
        </div>

        {/* Panneaux contrat + trajets empilés sur le côté droit. Filtrés
            automatiquement sur l'intervenant connecté — on attend le profile
            pour éviter de leaker les données des autres intervenants pendant
            le 1er render. */}
        {employeeId && (
          <div className="flex flex-col gap-5 min-w-0">
            <ContractSummaryPanel
              from={window.from}
              to={window.to}
              employeeFilter={employeeId}
            />
            <TripSummaryPanel
              from={window.from}
              to={window.to}
              employeeFilter={employeeId}
            />
          </div>
        )}
      </div>

      {/* Tooltip hover : passe une no-op onToggle (lecture seule côté intervenant) */}
      {hover && (
        <EventTooltip
          ev={hover.ev}
          x={hover.x}
          y={hover.y}
          onToggle={() => { /* lecture seule */ }}
          hidePricing  /* F1 — l'intervenant ne voit pas les prix/totaux */
        />
      )}
    </>
  );
}
