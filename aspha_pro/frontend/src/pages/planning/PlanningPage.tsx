import { useMemo, useRef, useState } from "react";
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
import { useClientMissions } from "@/hooks/use-missions";
import { useProducts } from "@/hooks/use-products";
import { useConflictCheck, type ConflictItem } from "@/hooks/use-conflict-check";
import { useClientAddresses } from "@/hooks/use-sub-resources";
import { ConflictWarningDialog } from "./ConflictWarningDialog";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Map as MapIcon, Download } from "lucide-react";
import { exportPlanningToPdf } from "@/lib/export-planning-pdf";
import { MatchingSuggestionsDialog } from "@/components/MatchingSuggestionsDialog";
import { EventTooltip } from "./EventTooltip";
import { LongAbsenceBanner } from "./LongAbsenceBanner";
import { ContractSummaryPanel } from "./ContractSummaryPanel";
import { ContextMenuPlanning } from "./ContextMenuPlanning";
import { ContextMenuEvent } from "./ContextMenuEvent";
import { TripSummaryPanel } from "./TripSummaryPanel";
import { AvailableEmployeesMap } from "./AvailableEmployeesMap";
import { EditInterventionDialog } from "./EditInterventionDialog";
import { EmptyFilterState } from "./EmptyFilterState";

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
 * Couleurs d'un event en fonction de SON STATUT (D2).
 *
 *  - annulee                       → 🔴 rouge
 *  - a_pourvoir                    → 🟠 orange
 *  - planifiee                     → 🔵 bleu
 *  - realisee AVEC checkin badgé   → 🟢 vert
 *  - realisee SANS checkin         → 🟣 violet (badgeage manquant)
 *  - draft / terminated (fallback) → ⚪ gris neutre
 *
 * `borderColor` reste transparent sauf pour le vert "réalisé + badgé" où on
 * garde une bordure verte plus soutenue (cohérence avec l'ancienne logique).
 */
const STATUS_COLORS = {
  annulee: "#ef4444",        // red-500
  a_pourvoir: "#f97316",     // orange-500
  planifiee: "#3b82f6",      // blue-500
  realisee_done: "#22c55e",  // green-500 (réalisée + badgée)
  realisee_pending: "#a855f7", // purple-500 (réalisée sans checkin)
  neutral: "#94a3b8",        // slate-400 (draft / terminated / inconnu)
} as const;

function statusColor(iv: { status?: string | null; checkin?: { checkin_time?: string | null } | null }): {
  background: string;
  border: string;
} {
  switch (iv.status) {
    case "annulee":
      return { background: STATUS_COLORS.annulee, border: "transparent" };
    case "a_pourvoir":
      return { background: STATUS_COLORS.a_pourvoir, border: "transparent" };
    case "planifiee":
      return { background: STATUS_COLORS.planifiee, border: "transparent" };
    case "realisee":
      return iv.checkin?.checkin_time
        ? { background: STATUS_COLORS.realisee_done, border: "#16a34a" }
        : { background: STATUS_COLORS.realisee_pending, border: "transparent" };
    default: // draft / terminated / inconnu
      return { background: STATUS_COLORS.neutral, border: "transparent" };
  }
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
  // selectedEndDate : si le user a fait un drag sur le calendar, on récupère
  // aussi l'heure de fin pour la pré-remplir (sinon par défaut + 2h).
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>();
  // Dialog warning quand un drag-drop crée des conflits horaires.
  // Stocke aussi le callback `revert` de FullCalendar pour permettre à
  // l'utilisateur d'annuler son déplacement depuis la pop-up.
  const [conflictDialog, setConflictDialog] = useState<{
    conflicts: ConflictItem[];
    onRevert: () => void;
  } | null>(null);
  // Verrou pendant le check-conflict async + tant que la modal est ouverte :
  // sans ça, l'utilisateur peut commencer un nouveau drag pendant qu'on
  // attend la réponse API, ce qui crée un état FullCalendar incohérent
  // (le drag suivant reste "stuck", impossible de bouger quoi que ce soit).
  // Cf. session 2026-05-18 19:30.
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  const calendarLocked = isCheckingConflict || conflictDialog !== null;
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

  // Ref vers FullCalendar pour exporter le DOM en PDF
  const calendarRef = useRef<FullCalendar | null>(null);
  // Vue active (timeGridWeek / dayGridMonth / ...) — pour conditionner le
  // bouton "Export PDF" (uniquement semaine + mois).
  const [currentView, setCurrentView] = useState<string>("timeGridWeek");
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Génère un nom de fichier en fonction de la vue active.
   *  - timeGridWeek  → "aspha-planning-semaine-YYYY-Www.pdf"
   *  - dayGridMonth  → "aspha-planning-mois-YYYY-MM.pdf"
   */
  const buildPdfFilename = (viewName: string, anchor: Date): string => {
    const y = anchor.getFullYear();
    if (viewName === "dayGridMonth") {
      const m = String(anchor.getMonth() + 1).padStart(2, "0");
      return `aspha-planning-mois-${y}-${m}.pdf`;
    }
    // ISO week number (lundi = jour 1)
    const d = new Date(Date.UTC(y, anchor.getMonth(), anchor.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `aspha-planning-semaine-${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}.pdf`;
  };

  const handleExportPdf = async () => {
    const api = calendarRef.current?.getApi();
    if (!api) {
      toast.error("Calendrier non prêt — réessaye dans un instant");
      return;
    }
    const viewName = api.view.type;
    const anchor = api.getDate();
    const filename = buildPdfFilename(viewName, anchor);
    // Le wrapper DOM réel du calendar (classe .fc générée par FullCalendar).
    const el = (document.querySelector(".fc") as HTMLElement | null);
    if (!el) {
      toast.error("Impossible de capturer le calendrier (DOM introuvable)");
      return;
    }
    setIsExporting(true);
    const t = toast.loading("Génération du PDF…");
    try {
      await exportPlanningToPdf(el, filename);
      toast.success(`PDF généré : ${filename}`, { id: t });
    } catch (err: any) {
      console.error("Export PDF KO", err);
      toast.error(`Échec export PDF : ${err?.message ?? "erreur inconnue"}`, { id: t });
    } finally {
      setIsExporting(false);
    }
  };

  const canExport = currentView === "timeGridWeek" || currentView === "dayGridMonth";

  const { data: employeesData } = useEmployees({ per_page: 100 });
  const { data: clientsData } = useClients({ per_page: 100 });
  const employees = employeesData?.data ?? [];
  const clients = clientsData?.data ?? [];

  // ⚠️ RÈGLE MÉTIER : pas d'affichage "Tous" possible (trop de données).
  // L'admin doit OBLIGATOIREMENT sélectionner un intervenant OU un client (ou les deux)
  // pour voir le planning. Sans filtre, on n'appelle pas l'API.
  const hasFilter = employeeFilter !== null || clientFilter !== null;

  const interventions = useInterventions({
    from: window.from,
    to: window.to,
    employee_id: employeeFilter ?? undefined,
    client_id: clientFilter ?? undefined,
    enabled: hasFilter,  // ← passé au hook pour conditionner le fetch
  } as any);
  const update = useUpdateIntervention();
  const del = useDeleteIntervention();
  const createException = useCreateInterventionException();

  // Events sont des occurrences expansées (1 event = 1 RDV concret, même pour les récurrentes)
  const events: EventInput[] = useMemo(() => (interventions.data ?? []).map((ev) => {
    const employeeName = ev.employee?.name ?? "À pourvoir";
    const clientLabel = ev.client?.company_name ?? ev.client?.code ?? "?";
    // Couleurs pilotées par le STATUT du RDV (D2) — cf. statusColor().
    const { background, border } = statusColor(ev);
    // Le titre est volontairement court ; l'event content riche fait le reste.
    return {
      id: ev.id,
      title: `${clientLabel}\n${employeeName}`,
      start: ev.start_datetime,
      end: ev.end_datetime,
      backgroundColor: background,
      borderColor: border,
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
    // Synchronise la vue active (utilisé pour conditionner le bouton export PDF).
    if (arg.view?.type && arg.view.type !== currentView) {
      setCurrentView(arg.view.type);
    }
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
        onSuccess: () => {
          toast.success("Occurrence déplacée (exception créée sur la série)");
          // Idem ponctuelle : check conflits après le déplacement
          const empId = ev.employee?.id;
          const cliId = ev.client?.id;
          if (empId && cliId && arg.oldEvent.start && arg.oldEvent.end) {
            const oldStart = localISO(arg.oldEvent.start);
            const oldEnd = localISO(arg.oldEvent.end);
            checkConflictAfterDrop(
              {
                employee_id: empId,
                client_id: cliId,
                start_datetime: startLocal,
                end_datetime: endLocal,
                intervention_id: ev.intervention_id,
              },
              oldStart,
              oldEnd,
              () => arg.revert(),
            );
          }
        },
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
      onSuccess: () => {
        toast.success(ev.is_exception ? "Exception déplacée" : "Intervention déplacée");
        // Check conflits horaires APRÈS le déplacement.
        // Cf. session 2026-05-18 : un drag-drop sans avertissement quand
        // les RDV consécutifs ne laissent pas assez de temps de trajet
        // était silencieux. Maintenant on toast un warning détaillé.
        // L'expander expose `ev.client.id` et `ev.employee.id` (objets),
        // pas `ev.client_id` direct — utiliser le bon chemin.
        const empId = ev.employee?.id;
        const cliId = ev.client?.id;
        if (empId && cliId && arg.oldEvent.start && arg.oldEvent.end) {
          const oldStart = localISO(arg.oldEvent.start);
          const oldEnd = localISO(arg.oldEvent.end);
          checkConflictAfterDrop(
            {
              employee_id: empId,
              client_id: cliId,
              start_datetime: startLocal,
              end_datetime: endLocal,
              intervention_id: ev.intervention_id,
            },
            oldStart,
            oldEnd,
            () => arg.revert(),
          );
        }
      },
      onError: (err: any) => {
        // Avant : arg.revert() silencieux -> impression "le drag-drop ne marche pas".
        // On affiche maintenant l'erreur backend pour debug.
        // Précédence `??` vs ternaire `?:` : on extrait proprement le premier
        // message de validation Laravel (errors[champ][0]) puis le message
        // global, sinon un fallback générique.
        const errors = err?.response?.data?.errors;
        const firstFieldError = errors
          ? (Object.values(errors).flat()[0] as string | undefined)
          : undefined;
        const msg = err?.response?.data?.message
          ?? firstFieldError
          ?? "Impossible de déplacer cette intervention";
        toast.error(msg);
        console.error("Drag-drop intervention KO", err?.response?.data);
        arg.revert();
      },
    });
  };

  /**
   * Appelle /interventions/check-conflict en mode "post-mortem" après un
   * déplacement réussi. Affiche les conflits détectés dans un dialog
   * pop-up modal (plus visible qu'un toast pour quelque chose d'important
   * — décision UX 2026-05-18).
   *
   * Le dialog propose 2 actions :
   *  - "Annuler le déplacement" → appelle arg.revert() de FullCalendar
   *  - "Garder le déplacement" → ferme juste le dialog
   *
   * On utilise un appel direct api.post plutôt que le hook useConflictCheck
   * car on est dans un handler, pas dans un composant. Pas de debounce
   * nécessaire (un seul drag = un seul check).
   */
  const checkConflictAfterDrop = async (
    params: {
      employee_id: number;
      client_id: number;
      start_datetime: string;
      end_datetime: string;
      intervention_id: number;
    },
    /** Datetimes AVANT le drag, pour vrai revert via PATCH inverse. */
    oldStart: string,
    oldEnd: string,
    /** Callback FullCalendar pour le revert visuel synchrone. */
    fcRevert: () => void,
  ) => {
    // Lock IMMÉDIATEMENT le calendar avant l'appel async — sinon l'utilisateur
    // peut commencer un autre drag pendant qu'on attend la réponse API.
    setIsCheckingConflict(true);
    try {
      const { api } = await import("@/lib/api");
      const { data } = await api.post<{
        data: { conflicts: ConflictItem[]; has_conflict: boolean };
      }>("/interventions/check-conflict", params);
      const conflicts = data.data.conflicts;
      if (conflicts.length === 0) return;

      // Pop-up modal au lieu d'un toast — bien plus visible
      setConflictDialog({
        conflicts,
        onRevert: () => {
          // Vrai revert : PATCH avec les anciennes datetimes, puis revert
          // visuel de FullCalendar pour cohérence immédiate.
          update.mutate({
            id: params.intervention_id,
            patch: {
              start_datetime: oldStart as any,
              end_datetime: oldEnd as any,
            },
          }, {
            onSuccess: () => {
              fcRevert();
              toast.success("Déplacement annulé — RDV remis à sa position d'origine");
            },
            onError: (err: any) => {
              toast.error(err?.response?.data?.message ?? "Impossible d'annuler le déplacement");
            },
          });
        },
      });
    } catch {
      // Silent fail — le drag est déjà committé, ce check est informatif.
    } finally {
      // Toujours déverrouiller : si conflit, le dialog prend le relais
      // via sa propre condition `conflictDialog !== null`.
      setIsCheckingConflict(false);
    }
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
    // FullCalendar émet `select` au clic sur un slot vide OU au drag de selection.
    // - Clic simple → arg.end = arg.start + slotDuration (ex: 5 min en zoom serré)
    //   → on FORCE 1h par défaut, sinon l'UX est terrible (RDV ridiculement courts)
    // - Drag → arg.end > arg.start + 15 min → on respecte la durée choisie
    const durationMs = arg.end.getTime() - arg.start.getTime();
    const isJustAClick = durationMs <= 15 * 60 * 1000;  // ≤ 15 min = clic
    const finalEnd = isJustAClick
      ? new Date(arg.start.getTime() + 60 * 60 * 1000)  // +1h par défaut
      : arg.end;

    setSelectedDate(arg.start);
    setSelectedEndDate(finalEnd);
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
        description="Interventions ponctuelles et récurrentes — drag-and-drop pour déplacer, clic droit pour créer rapidement"
        actions={
          <div className="flex items-center gap-2">
            {canExport && hasFilter && (
              <Button
                type="button"
                variant="outline"
                disabled={isExporting}
                onClick={handleExportPdf}
                title="Exporter la vue actuelle en PDF (A4 paysage)"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {isExporting ? "Génération…" : "Télécharger PDF"}
              </Button>
            )}
            <Button
              onClick={() => { setSelectedDate(undefined); setCreateMode("ponctuel"); setCreateOpen(true); }}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Nouvelle intervention
            </Button>
          </div>
        }
      />

      {/* Filtres en card 3D — au moins un filtre OBLIGATOIRE */}
      <div className="mb-5 px-4 py-3 rounded-2xl bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Label className="text-xs font-medium text-muted-foreground shrink-0">Intervenant</Label>
            <select value={employeeFilter ?? ""} onChange={(e) => setEmployeeFilter(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm cursor-pointer hover:border-primary/40 transition-colors">
              <option value="">— Aucun —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Label className="text-xs font-medium text-muted-foreground shrink-0">Client</Label>
            <select value={clientFilter ?? ""} onChange={(e) => setClientFilter(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm cursor-pointer hover:border-primary/40 transition-colors">
              <option value="">— Aucun —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
            </select>
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEmployeeFilter(null); setClientFilter(null); }}
              className="text-xs"
            >
              Réinitialiser
            </Button>
          )}
        </div>
        {hasFilter && (
          <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Filtre actif :</span>
            {employeeFilter !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                Intervenant : {employees.find((e) => e.id === employeeFilter)?.full_name}
                <button type="button" onClick={() => setEmployeeFilter(null)} className="hover:bg-primary/20 rounded px-1 cursor-pointer">×</button>
              </span>
            )}
            {clientFilter !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium">
                Client : {clients.find((c) => c.id === clientFilter)?.company?.company_name ?? clients.find((c) => c.id === clientFilter)?.code}
                <button type="button" onClick={() => setClientFilter(null)} className="hover:bg-sky-500/20 rounded px-1 cursor-pointer">×</button>
              </span>
            )}
            <span className="ml-auto">Clic droit sur le calendrier pour créer rapidement</span>
          </div>
        )}
      </div>

      {/* Légende des couleurs de statut (D2) */}
      {hasFilter && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-card shadow-soft flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="font-medium text-muted-foreground">Légende :</span>
          {[
            { c: STATUS_COLORS.a_pourvoir, label: "À pourvoir" },
            { c: STATUS_COLORS.planifiee, label: "Planifiée" },
            { c: STATUS_COLORS.realisee_done, label: "Réalisée + badgée" },
            { c: STATUS_COLORS.realisee_pending, label: "Réalisée (badgeage manquant)" },
            { c: STATUS_COLORS.annulee, label: "Annulée" },
            { c: STATUS_COLORS.neutral, label: "Brouillon / Terminée" },
          ].map((it) => (
            <span key={it.label} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: it.c }} />
              <span className="text-muted-foreground">{it.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Bandeau absences longue durée */}
      {hasFilter && <LongAbsenceBanner from={window.from} to={window.to} />}

      {!hasFilter ? (
        <EmptyFilterState
          employees={employees}
          clients={clients}
          onPickEmployee={(id) => setEmployeeFilter(id)}
          onPickClient={(id) => setClientFilter(id)}
        />
      ) : (
      <div className="flex flex-col gap-5">
      <div
        className={
          "rounded-2xl bg-card shadow-soft p-4 lg:p-5 transition-opacity w-full " +
          (calendarLocked ? "opacity-70 pointer-events-none" : "")
        }
        onContextMenu={handleContextMenu}
      >
        <FullCalendar
          ref={calendarRef}
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
          editable={!calendarLocked}
          selectable={!calendarLocked}
          // Affichage 24h fixe (demande métier)
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          // Granularité RDV à 15 minutes (slot + snap drag-and-drop)
          slotDuration="00:15:00"
          snapDuration="00:15:00"
          allDaySlot={false}
          nowIndicator
          // Force l'affichage en bloc coloré sur TOUTES les vues (sinon
          // dayGridMonth utilise un pastille "dot" qui ignore backgroundColor).
          eventDisplay="block"
          // Idem pour la vue mois précisément — garantit les barres pleines.
          views={{
            dayGridMonth: { eventDisplay: "block" },
          }}
          height={700}
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

            // === BADGE BADGEAGE QR avec couleur progressive ===
            // - Pas de checkin alors que start passé : ⚠ orange foncé (oubli)
            // - Pas de checkin mais futur : juste icône grise neutre
            // - Checkin à l'heure (± 5 min) : ✓ vert
            // - Checkin en retard (5-15 min) : ⏰ orange (retard léger)
            // - Checkin en très retard (>15 min) : ⏰ rouge
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
              // RDV passé sans checkin → alerte oubli
              badgeNode = (
                <span className="inline-flex items-center gap-0.5 bg-orange-500/90 text-white text-[9px] px-1 py-px rounded-sm font-semibold">
                  ⚠ Non pointé
                </span>
              );
            }

            // === BADGE CLÉ ===
            // Vert si clé ASSIGNÉE explicitement au RDV (l'intervenant sait laquelle)
            // Ambre si le client a des clés mais aucune n'est assignée au RDV
            const keyBadge = iv.assigned_key ? (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-emerald-500/90 text-white rounded-sm text-[10px]" title={`Clé assignée : ${iv.assigned_key.label}`}>
                🔑
              </span>
            ) : iv.client?.has_keys ? (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500/90 text-white rounded-sm text-[10px]" title={`${iv.client.keys_count} clé(s) disponible(s) (aucune assignée)`}>
                🔑
              </span>
            ) : null;

            // === BADGE RÉCURRENT ===
            const recurringBadge = iv.is_recurring ? (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-violet-500/90 text-white rounded-sm text-[10px]" title="Intervention récurrente">
                🔁
              </span>
            ) : null;

            const clientLabel = iv.client?.company_name ?? iv.client?.code ?? "?";
            const employeeLabel = iv.employee?.name ?? "À pourvoir";

            return (
              <div className="h-full w-full flex flex-col items-center justify-center text-center overflow-hidden px-1 py-1 gap-0.5">
                {/* Ligne badges en haut à droite */}
                {(keyBadge || recurringBadge) && (
                  <div className="self-end flex items-center gap-0.5 absolute top-0.5 right-0.5">
                    {recurringBadge}
                    {keyBadge}
                  </div>
                )}
                {/* Client en gros */}
                <div className="font-bold text-[13px] leading-tight truncate w-full">
                  {clientLabel}
                </div>
                {/* Intervenant */}
                <div className="text-[11px] opacity-95 font-medium leading-tight truncate w-full">
                  {employeeLabel}
                </div>
                {/* Horaires */}
                <div className="text-[10px] opacity-80 leading-tight">
                  {start}–{end}
                </div>
                {/* Badge checkin */}
                {badgeNode && <div className="mt-0.5">{badgeNode}</div>}
              </div>
            );
          }}
        />
      </div>

      {/* Panneau infos en BAS — trajets + contrat côte à côte (60/40). */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
        <TripSummaryPanel
          from={window.from}
          to={window.to}
          employeeFilter={employeeFilter}
        />
        <ContractSummaryPanel
          from={window.from}
          to={window.to}
          employeeFilter={employeeFilter}
          clientFilter={clientFilter}
        />
      </div>
      </div>
      )}

      {/* Création */}
      {/*
        `key` force le remount du dialog quand selectedDate change, ce qui
        ré-initialise le useState interne du form avec les nouvelles valeurs.
        Sans cette key, useState ne re-run pas son initializer et le form
        garde les anciennes date/heure -> impression "le click sur le slot
        n'est pas détecté".
      */}
      <CreateInterventionDialog
        key={`create-${selectedDate?.getTime() ?? "manual"}-${createMode}`}
        open={createOpen}
        defaultDate={selectedDate}
        defaultEndDate={selectedEndDate}
        mode={createMode}
        onClose={() => {
          setCreateOpen(false);
          setSelectedDate(undefined);
          setSelectedEndDate(undefined);
        }}
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

      {/* Pop-up de warning conflits horaires apres drag-drop */}
      {conflictDialog && (
        <ConflictWarningDialog
          open={true}
          conflicts={conflictDialog.conflicts}
          onClose={() => setConflictDialog(null)}
          onRevert={conflictDialog.onRevert}
        />
      )}

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

/**
 * Ajoute N heures à une heure "HH:MM" (clamp à 23:59).
 */
function addHours(time: string, h: number): string {
  const [hh, mm] = time.split(":").map(Number);
  const totalMin = Math.min(hh * 60 + mm + h * 60, 23 * 60 + 59);
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
}

function CreateInterventionDialog({ open, defaultDate, defaultEndDate, mode, onClose, clients, employees }: {
  open: boolean;
  defaultDate?: Date;
  /** Heure de fin pré-remplie (passée par FullCalendar `select` event). */
  defaultEndDate?: Date;
  mode: "ponctuel" | "recurrent" | "absence" | "indispo";
  onClose: () => void;
  clients: any[];
  employees: any[];
}) {
  const create = useCreateIntervention();
  // Flag qui passe à true dès la 1ère tentative de submit avec erreurs.
  // Permet d'afficher les anneaux rouges sur les WizardStep concernés
  // SANS surcharger l'UI tant que l'utilisateur n'a pas encore essayé.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  // Pour la date : on prend le local (yyyy-MM-dd) plutôt que toISOString
  // qui converti en UTC et peut donner une date différente près de minuit.
  const localDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const localTimeStr = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const startD = defaultDate ?? new Date();
  // Si pas de defaultEndDate (clic simple sans drag), on garde la convention
  // +2h sur l'heure de début.
  const endD = defaultEndDate ?? new Date(startD.getTime() + 2 * 60 * 60 * 1000);

  const initialDate = localDateStr(startD);
  const initialTime = localTimeStr(startD);
  const initialEndDate = localDateStr(endD);
  const initialEndTime = localTimeStr(endD);
  const isRecurring = mode === "recurrent";
  const isAbsence = mode === "absence";
  const isIndispo = mode === "indispo";
  const [form, setForm] = useState<any>({
    client_id: "",
    // Rattachement : 'mission' = lié à une mission/prestation existante,
    // 'standalone' = intervention ponctuelle. Pour un RDV ponctuel standalone,
    // l'admin peut choisir des prestations du catalogue : la validation crée
    // alors une mission + un devis brouillon (cf. backend 2026-05-21).
    link_type: "mission",
    mission_id: "",
    client_prestation_id: "",
    // Prestations choisies pour un RDV ponctuel standalone (catalogue).
    // Chaque entrée : { product_id, label, unit_price, billing_type }.
    standalone_prestations: [] as Array<{
      product_id: number | null;
      label: string;
      unit_price: number | null;
      billing_type: string;
    }>,
    employee_id: "",
    status: "planifiee",
    // Adresse d'intervention (D1) — vide = adresse par défaut du client.
    address_id: "",
    // ⚠️ date et heure séparés pour la lisibilité (recomposés à la soumission)
    start_date: initialDate,
    start_time_h: initialTime,
    end_date: initialEndDate,
    end_time_h: initialEndTime,
    recurrence_start_date: initialDate,
    start_time: initialTime,
    end_time: initialEndTime,
    frequency: "weekly",
    days_of_week: "mon",
    // Détails (étape 4)
    transport_mode: "",
    vehicle_type: "",
    bill_client: true,
    is_paid: true,
    comment: "",
    internal_comment: "",
    // Absence/Indispo
    absence_start_date: initialDate,
    absence_end_date: initialDate,
    absence_reason: "",
  });

  // Datetime recomposés pour la map + le payload
  const start_datetime = `${form.start_date}T${form.start_time_h}:00`;
  const end_datetime = `${form.end_date}T${form.end_time_h}:00`;

  // Reset le form quand le mode change (pour qu'on parte sur du frais)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // → on garde simple : le user clique soit "ponctuel" soit "recurrent" et ça refait un render

  /**
   * Valide le form AVANT submit. Retourne la liste des erreurs explicites
   * (champs manquants ou invalides). Vide = OK pour soumettre.
   *
   * Décision UX du 2026-05-18 : on n'autorise PAS le submit silencieux
   * quand un champ requis manque. À la place on affiche un toast clair
   * listant tout ce qui manque + on ne ferme PAS le dialog.
   */
  // Si l'utilisateur a déjà essayé de submit et qu'il corrige des champs,
  // on retire le flag dès que la validation passe → l'UI se "déstresse"
  // automatiquement (anneaux rouges disparaissent).
  // Pas besoin de useEffect : on check juste à chaque render.

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (isAbsence) {
      if (!form.employee_id) errors.push("Choisis un intervenant");
      if (!form.absence_start_date) errors.push("Date de début manquante");
      if (!form.absence_end_date) errors.push("Date de fin manquante");
      return errors;
    }
    if (isIndispo) {
      if (!form.client_id) errors.push("Choisis un client");
      if (!form.absence_start_date) errors.push("Date de début manquante");
      if (!form.absence_end_date) errors.push("Date de fin manquante");
      return errors;
    }

    // Cas RDV (ponctuel ou récurrent)
    if (!form.client_id) errors.push("Sélectionne un client");

    // Rattachement : mission requiert mission_id, standalone OK
    if (form.link_type === "mission" && !form.mission_id) {
      errors.push("Choisis une mission OU passe en « Intervention ponctuelle »");
    }

    // Prestations standalone : si l'admin en a ajouté, chacune doit avoir un libellé.
    if (form.link_type === "standalone" && Array.isArray(form.standalone_prestations)) {
      form.standalone_prestations.forEach((p: any, i: number) => {
        if (!p.label?.trim()) {
          errors.push(`Prestation #${i + 1} : libellé manquant`);
        }
      });
    }

    // Date/horaires
    if (isRecurring) {
      if (!form.recurrence_start_date) errors.push("Date de début de la récurrence manquante");
      if (!form.start_time) errors.push("Heure de début manquante");
      if (!form.end_time) errors.push("Heure de fin manquante");
    } else {
      if (!form.start_date || !form.start_time_h) errors.push("Date/heure de début manquante");
      if (!form.end_date || !form.end_time_h) errors.push("Date/heure de fin manquante");
      // Cohérence début < fin
      if (form.start_date && form.end_date && form.start_time_h && form.end_time_h) {
        const s = new Date(`${form.start_date}T${form.start_time_h}:00`);
        const e = new Date(`${form.end_date}T${form.end_time_h}:00`);
        if (e <= s) errors.push("L'heure de fin doit être après l'heure de début");
      }
    }

    return errors;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation centralisée : on ne soumet rien tant que tous les champs
    // requis ne sont pas remplis. Le toast liste explicitement ce qui manque
    // pour éviter le "rien ne se passe" silencieux.
    const errors = validateForm();
    if (errors.length > 0) {
      setAttemptedSubmit(true);
      toast.error(`Impossible de créer le RDV — ${errors.length} info(s) à compléter`, {
        description: errors.map((e) => `• ${e}`).join("\n"),
        duration: 6000,
      });
      return;
    }

    // Si conflit BLOQUANT (overlap), on demande confirmation explicite avant
    // de créer. Les warnings (trajet trop court) ne bloquent pas — déjà
    // affichés dans le bandeau au-dessus du bouton, le user voit avant submit.
    if (hasConflictError) {
      const overlapMsg = conflicts.find((c) => c.severity === "error")?.message
        ?? "Ce RDV chevauche un autre RDV.";
      if (!confirm(`⚠ ${overlapMsg}\n\nCréer quand même ?`)) {
        return;
      }
    }

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

    // Si rattaché à une mission, on transmet mission_id + client_prestation_id
    // (sinon null = intervention ponctuelle one-shot). Le backend les a en nullable.
    const linkedToMission = form.link_type === "mission";
    const payload: any = {
      client_id: parseInt(form.client_id, 10),
      mission_id: linkedToMission && form.mission_id ? parseInt(form.mission_id, 10) : null,
      client_prestation_id: linkedToMission && form.client_prestation_id
        ? parseInt(form.client_prestation_id, 10) : null,
      employee_id: form.employee_id ? parseInt(form.employee_id, 10) : null,
      address_id: form.address_id ? parseInt(form.address_id, 10) : null,
      is_recurring: isRecurring,
      status: form.status,
      comment: form.comment || null,
      internal_comment: form.internal_comment || null,
      transport_mode: form.transport_mode || null,
      vehicle_type: form.vehicle_type || null,
      bill_client: form.bill_client,
      is_paid: form.is_paid,
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
        start_datetime,
        end_datetime,
      });
    }

    // RDV ponctuel standalone + prestations choisies → le backend crée
    // automatiquement la mission + le devis brouillon et y rattache ce RDV.
    if (
      !isRecurring &&
      !linkedToMission &&
      Array.isArray(form.standalone_prestations) &&
      form.standalone_prestations.length > 0
    ) {
      payload.prestations = form.standalone_prestations.map((p: any) => ({
        product_id: p.product_id,
        label: p.label,
        unit_price: p.unit_price,
        billing_type: p.billing_type || "forfait",
      }));
    }

    // IMPORTANT : try/catch obligatoire — sans lui, mutateAsync rejette
    // silencieusement et le dialog reste ouvert, donnant l'impression que
    // "rien ne se passe" alors qu'une 422 a été retournée par le backend.
    try {
      await create.mutateAsync(payload);
      if (payload.prestations?.length) {
        toast.success("RDV ponctuel créé", {
          description: `Mission et devis brouillon générés (${payload.prestations.length} prestation(s)).`,
        });
      } else {
        toast.success("Intervention créée");
      }
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      // Affiche le premier message de validation Laravel s'il existe,
      // sinon le message générique. La console garde le détail complet.
      const firstFieldError = data?.errors
        ? Object.values(data.errors).flat()[0]
        : null;
      const message = (firstFieldError as string | undefined)
        ?? data?.message
        ?? "Création impossible — vérifie les champs requis.";
      console.error("Création intervention échouée", { payload, response: data });
      toast.error(message);
    }
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

  // Étapes pour le wizard (mode ponctuel ou récurrent)
  const step1Done = !!form.client_id;
  // Étape 2 = rattachement : standalone toujours OK,
  // mission requiert au moins le choix d'une mission (prestation optionnelle).
  const step2Done = form.link_type === "standalone" || !!form.mission_id;
  const step3Done = isRecurring
    ? !!form.recurrence_start_date && !!form.start_time && !!form.end_time
    : !!form.start_date && !!form.start_time_h && !!form.end_date && !!form.end_time_h;
  // Le picker map ne fonctionne que pour les ponctuelles (besoin de start/end datetime concrets)
  const showMapPicker = !isRecurring && step1Done && step3Done;

  const selectedClient = clients.find((c: any) => String(c.id) === form.client_id);

  // Adresses du client sélectionné (D1) — pour le sélecteur d'adresse
  // d'intervention. Le hook est désactivé tant qu'aucun client n'est choisi.
  const { data: clientAddresses = [] } = useClientAddresses(
    form.client_id ? parseInt(form.client_id, 10) : 0,
  );

  // Détection de conflits horaires en temps réel (RDV qui se chevauchent,
  // temps de trajet trop court entre 2 RDV consécutifs). Pas bloquant : le
  // user peut quand même créer s'il accepte le risque. Désactivé pour les
  // récurrents (pas pertinent — pas de "RDV avant/après" sur une série).
  const { conflicts, hasError: hasConflictError } = useConflictCheck({
    employee_id: form.employee_id && !isRecurring ? parseInt(form.employee_id, 10) : null,
    client_id: form.client_id ? parseInt(form.client_id, 10) : null,
    start_datetime: !isRecurring && form.start_date && form.start_time_h
      ? `${form.start_date}T${form.start_time_h}:00`
      : null,
    end_datetime: !isRecurring && form.end_date && form.end_time_h
      ? `${form.end_date}T${form.end_time_h}:00`
      : null,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className={
          showMapPicker
            ? "w-[96vw] sm:!max-w-[1280px] h-[88vh] max-h-[88vh] sm:rounded-2xl p-0 flex flex-col overflow-hidden gap-0"
            : "w-[96vw] sm:!max-w-lg max-h-[88vh] p-0 flex flex-col overflow-hidden gap-0"
        }
      >
        {/* === HEADER fixe === */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-xl tracking-tight">{title}</DialogTitle>
          {step1Done && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedClient?.company?.company_name ?? selectedClient?.code ?? "—"}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
          <div className={`flex-1 min-h-0 ${showMapPicker ? "grid grid-cols-1 lg:grid-cols-[400px_1fr]" : ""}`}>
            {/* === COLONNE GAUCHE : formulaire en étapes (scrollable) === */}
            <div className="overflow-y-auto p-5 lg:p-6 space-y-4 lg:border-r">
              {/* ÉTAPE 1 : Client */}
              <WizardStep n={1} title="Client" done={step1Done} error={attemptedSubmit && !step1Done}>
                <select value={form.client_id} onChange={(e) => setForm((f: any) => ({
                  ...f,
                  client_id: e.target.value,
                  // Reset rattachement + adresse quand on change de client
                  mission_id: "",
                  client_prestation_id: "",
                  address_id: "",
                }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-10 cursor-pointer hover:border-primary/40 transition-colors" required>
                  <option value="">— Choisir un client —</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company?.company_name ?? c.code}</option>)}
                </select>

                {/* Adresse d'intervention (D1) — affichée dès que le client
                    a au moins une adresse enregistrée. */}
                {step1Done && clientAddresses.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      <MapIcon className="h-3 w-3" />
                      Adresse d'intervention
                    </Label>
                    <select
                      value={form.address_id}
                      onChange={(e) => setForm((f: any) => ({ ...f, address_id: e.target.value }))}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer hover:border-primary/40 transition-colors"
                    >
                      <option value="">Adresse par défaut du client</option>
                      {clientAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.type}] {a.address}{a.city ? ` — ${a.postal_code ?? ""} ${a.city}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </WizardStep>

              {/* ÉTAPE 2 : Rattachement Mission/Ponctuel */}
              <WizardStep n={2} title="Rattachement" done={step2Done} disabled={!step1Done} error={attemptedSubmit && step1Done && !step2Done}>
                <MissionLinkStep
                  clientId={form.client_id ? parseInt(form.client_id, 10) : null}
                  linkType={form.link_type}
                  missionId={form.mission_id}
                  prestationId={form.client_prestation_id}
                  standalonePrestations={form.standalone_prestations}
                  onLinkTypeChange={(t) => setForm((f: any) => ({
                    ...f,
                    link_type: t,
                    // Si on bascule en ponctuel, on efface mission + prestation
                    mission_id: t === "standalone" ? "" : f.mission_id,
                    client_prestation_id: t === "standalone" ? "" : f.client_prestation_id,
                  }))}
                  onMissionChange={(id) => setForm((f: any) => ({
                    ...f,
                    mission_id: id,
                    // Reset prestation quand on change de mission
                    client_prestation_id: "",
                  }))}
                  onPrestationChange={(id) => setForm((f: any) => ({ ...f, client_prestation_id: id }))}
                  onStandalonePrestationsChange={(list) =>
                    setForm((f: any) => ({ ...f, standalone_prestations: list }))
                  }
                />
              </WizardStep>

              {/* ÉTAPE 3 : Date + Heure SÉPARÉS */}
              <WizardStep n={3} title="Date et horaires" done={step3Done} disabled={!step1Done || !step2Done} error={attemptedSubmit && step1Done && step2Done && !step3Done}>
                {!isRecurring ? (
                  <div className="space-y-3">
                    {/* Début */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Début</Label>
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <Input type="date" value={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))} required />
                        <Input type="time" value={form.start_time_h} onChange={(e) => setForm((f: any) => ({ ...f, start_time_h: e.target.value }))} required />
                      </div>
                    </div>
                    {/* Fin */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fin</Label>
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <Input type="date" value={form.end_date} min={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, end_date: e.target.value }))} required />
                        <Input type="time" value={form.end_time_h} onChange={(e) => setForm((f: any) => ({ ...f, end_time_h: e.target.value }))} required />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date début</Label>
                        <Input type="date" value={form.recurrence_start_date} onChange={(e) => setForm((f: any) => ({ ...f, recurrence_start_date: e.target.value }))} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fréquence</Label>
                        <select value={form.frequency} onChange={(e) => setForm((f: any) => ({ ...f, frequency: e.target.value }))}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
                          <option value="daily">Quotidienne</option>
                          <option value="weekly">Hebdomadaire</option>
                          <option value="monthly">Mensuelle</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Heure début</Label>
                        <Input type="time" value={form.start_time} onChange={(e) => setForm((f: any) => ({ ...f, start_time: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Heure fin</Label>
                        <Input type="time" value={form.end_time} onChange={(e) => setForm((f: any) => ({ ...f, end_time: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Jours de la semaine</Label>
                      <Input value={form.days_of_week} onChange={(e) => setForm((f: any) => ({ ...f, days_of_week: e.target.value }))} placeholder="mon,wed,fri" />
                      <p className="text-[10px] text-muted-foreground">Codes : mon, tue, wed, thu, fri, sat, sun (séparés par virgules)</p>
                    </div>
                  </div>
                )}
              </WizardStep>

              {/* ÉTAPE 4 : Intervenant */}
              <WizardStep n={4} title="Intervenant" done={!!form.employee_id} disabled={!step1Done || !step2Done || !step3Done}>
                {!step1Done || !step3Done ? (
                  <div className="text-xs italic text-muted-foreground bg-muted/40 rounded-md p-3 flex items-center gap-2">
                    <MapIcon className="h-3.5 w-3.5" />
                    Sélectionne le client et les horaires pour voir les intervenants disponibles.
                  </div>
                ) : isRecurring ? (
                  <select value={form.employee_id} onChange={(e) => setForm((f: any) => ({ ...f, employee_id: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
                    <option value="">À pourvoir</option>
                    {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                  </select>
                ) : (
                  <div>
                    {form.employee_id ? (
                      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">
                            {employees.find((e: any) => String(e.id) === form.employee_id)?.full_name ?? "Sélectionné"}
                          </div>
                          <div className="text-[10px] text-primary">✓ Affecté à ce RDV</div>
                        </div>
                        <button type="button" onClick={() => setForm((f: any) => ({ ...f, employee_id: "" }))}
                          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer underline">
                          Retirer
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5 flex items-center gap-2">
                        <MapIcon className="h-3.5 w-3.5 text-primary" />
                        <span>Choisis dans la carte <span className="hidden lg:inline">à droite</span><span className="lg:hidden">ci-dessous</span> ou laisse "À pourvoir"</span>
                      </div>
                    )}
                  </div>
                )}
              </WizardStep>

              {/* ÉTAPE 5 : Détails */}
              <WizardStep n={5} title="Détails (facultatif)" done={false} disabled={!step1Done || !step3Done}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Statut</Label>
                      <select value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
                        <option value="planifiee">Planifiée</option>
                        <option value="a_pourvoir">À pourvoir</option>
                        <option value="realisee">Terminée</option>
                        <option value="annulee">Annulée</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mode transport</Label>
                      <select value={form.transport_mode} onChange={(e) => setForm((f: any) => ({ ...f, transport_mode: e.target.value }))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
                        <option value="">—</option>
                        <option value="car">Voiture</option>
                        <option value="bike">Vélo</option>
                        <option value="walk">À pied</option>
                        <option value="transit">Transports</option>
                      </select>
                    </div>
                  </div>

                  {form.transport_mode === "car" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type véhicule</Label>
                      <select value={form.vehicle_type} onChange={(e) => setForm((f: any) => ({ ...f, vehicle_type: e.target.value }))}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer">
                        <option value="">—</option>
                        <option value="personal">Véhicule personnel</option>
                        <option value="company">Véhicule de service</option>
                      </select>
                    </div>
                  )}

                  {/* Toggles facturation / paiement */}
                  <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={form.bill_client}
                        onCheckedChange={(v) => setForm((f: any) => ({ ...f, bill_client: v === true }))}
                      />
                      <span className="font-medium">Facturer au client</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={form.is_paid}
                        onCheckedChange={(v) => setForm((f: any) => ({ ...f, is_paid: v === true }))}
                      />
                      <span className="font-medium">Payer l'intervenant</span>
                    </label>
                  </div>

                  {/* Commentaires */}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Commentaire admin</Label>
                    <Input value={form.comment} onChange={(e) => setForm((f: any) => ({ ...f, comment: e.target.value }))} placeholder="Notes visibles par tous les admins…" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Note interne</Label>
                    <Input value={form.internal_comment} onChange={(e) => setForm((f: any) => ({ ...f, internal_comment: e.target.value }))} placeholder="Note privée (non visible client/intervenant)…" />
                  </div>
                </div>
              </WizardStep>
            </div>

            {/* === COLONNE DROITE : map dispo intervenants (scrollable indépendamment) === */}
            {showMapPicker && (
              <div className="overflow-y-auto p-5 lg:p-6 bg-muted/20">
                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Choisir l'intervenant
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Cercle vert = zone de recherche · filtre rayon ↗️
                    </div>
                  </div>
                </div>
                <AvailableEmployeesMap
                  startDatetime={start_datetime}
                  endDatetime={end_datetime}
                  clientId={parseInt(form.client_id, 10)}
                  onAssign={(empId) => {
                    setForm((f: any) => ({ ...f, employee_id: String(empId) }));
                  }}
                />
              </div>
            )}
          </div>

          {/* Bandeau conflits horaires — affiché juste au-dessus du footer */}
          {conflicts.length > 0 && (
            <div
              className={
                "px-6 py-3 border-t shrink-0 space-y-1.5 " +
                (hasConflictError
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800")
              }
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={hasConflictError ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}
                >
                  ⚠ {conflicts.length === 1 ? "Conflit détecté" : `${conflicts.length} conflits détectés`}
                </span>
                {!hasConflictError && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (non bloquant — tu peux créer quand même)
                  </span>
                )}
              </div>
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  className={
                    "text-[11px] leading-snug pl-4 " +
                    (c.severity === "error"
                      ? "text-rose-900 dark:text-rose-100"
                      : "text-amber-900 dark:text-amber-100")
                  }
                >
                  • {c.message}
                </div>
              ))}
            </div>
          )}

          {/*
            FOOTER fixe — le bouton submit n'est plus disabled tant qu'un
            step n'est pas "done" : on laisse le user cliquer pour qu'il
            VOIE la liste précise de ce qui manque (via validateForm +
            toast). Seul `create.isPending` désactive (éviter double-submit).
          */}
          <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              type="submit"
              disabled={create.isPending}
              className="bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
            >
              {create.isPending ? "Création…" : "Créer l'intervention"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Étape du wizard : numéro dans rond + titre + état (done/disabled/active).
 */
function WizardStep({
  n, title, done, disabled, error, children,
}: {
  n: number;
  title: string;
  done: boolean;
  disabled?: boolean;
  /** Affiche un anneau rouge + chiffre rouge quand l'étape est en erreur après tentative submit. */
  error?: boolean;
  children: React.ReactNode;
}) {
  // L'état "error" prime sur les autres pour attirer l'attention.
  const state = error ? "error" : disabled ? "disabled" : done ? "done" : "active";
  const styles = {
    done: { ring: "ring-emerald-500/40", bg: "bg-emerald-500 text-white", text: "text-foreground" },
    active: { ring: "ring-primary/40", bg: "bg-gradient-aspha text-white", text: "text-foreground" },
    disabled: { ring: "ring-border", bg: "bg-muted text-muted-foreground", text: "text-muted-foreground" },
    error: { ring: "ring-rose-500", bg: "bg-rose-500 text-white", text: "text-rose-700 dark:text-rose-300" },
  }[state];

  return (
    <div className={`rounded-xl bg-card shadow-soft ring-2 ${styles.ring} p-4 transition-all`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 ${styles.bg}`}>
          {error ? "!" : done && !disabled ? "✓" : n}
        </div>
        <div className={`text-sm font-semibold tracking-tight ${styles.text}`}>{title}</div>
        {error && (
          <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-rose-600">
            À compléter
          </span>
        )}
      </div>
      <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
        {children}
      </div>
    </div>
  );
}

/**
 * Étape "Rattachement" du wizard de création RDV.
 *
 * Choix métier (cf. flow Xelya/Ximi) :
 *  - "mission"     : l'intervention est rattachée à une mission existante
 *                    du client → on choisit la mission + la prestation
 *                    (la prestation dicte le type de facturation et le prix).
 *  - "standalone"  : intervention ponctuelle one-shot, pas de contrat.
 *                    Utile pour les RDV exceptionnels, devis de présentation,
 *                    interventions facturées directement à la prestation.
 *
 * Si le client n'a aucune mission active, on bascule automatiquement en
 * "standalone" et on propose un lien vers la création de mission.
 */
/** Une prestation choisie pour un RDV ponctuel standalone (catalogue). */
type StandalonePrestation = {
  product_id: number | null;
  label: string;
  unit_price: number | null;
  billing_type: string;
};

function MissionLinkStep({
  clientId,
  linkType,
  missionId,
  prestationId,
  standalonePrestations,
  onLinkTypeChange,
  onMissionChange,
  onPrestationChange,
  onStandalonePrestationsChange,
}: {
  clientId: number | null;
  linkType: "mission" | "standalone";
  missionId: string;
  prestationId: string;
  standalonePrestations: StandalonePrestation[];
  onLinkTypeChange: (t: "mission" | "standalone") => void;
  onMissionChange: (id: string) => void;
  onPrestationChange: (id: string) => void;
  onStandalonePrestationsChange: (list: StandalonePrestation[]) => void;
}) {
  const { data: missions = [], isLoading } = useClientMissions(clientId ?? 0);
  const activeMissions = missions.filter((m) => m.status === "active");
  const selectedMission = missions.find((m) => String(m.id) === missionId);
  const prestations = selectedMission?.client_prestations ?? [];

  // Catalogue produits (pour les prestations d'un RDV ponctuel standalone).
  const { data: productsData } = useProducts({ per_page: 200, status: "active" });
  const catalogProducts: any[] = (productsData as any)?.data ?? [];

  // Ajoute une ligne de prestation vierge.
  const addPrestation = () => {
    onStandalonePrestationsChange([
      ...standalonePrestations,
      { product_id: null, label: "", unit_price: null, billing_type: "forfait" },
    ]);
  };
  // Met à jour une ligne (patch partiel).
  const updatePrestation = (idx: number, patch: Partial<StandalonePrestation>) => {
    onStandalonePrestationsChange(
      standalonePrestations.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };
  // Quand on choisit un produit du catalogue : pré-remplit label + prix.
  const pickProduct = (idx: number, productId: string) => {
    if (!productId) {
      updatePrestation(idx, { product_id: null });
      return;
    }
    const prod = catalogProducts.find((p) => String(p.id) === productId);
    updatePrestation(idx, {
      product_id: Number(productId),
      label: standalonePrestations[idx]?.label?.trim() || prod?.name || "",
      unit_price: prod?.price != null ? Number(prod.price) : null,
    });
  };
  const removePrestation = (idx: number) => {
    onStandalonePrestationsChange(standalonePrestations.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Toggle Mission vs Ponctuel */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onLinkTypeChange("mission")}
          className={
            "text-left rounded-lg border-2 px-3 py-2.5 transition-all " +
            (linkType === "mission"
              ? "border-primary bg-primary/5 shadow-soft"
              : "border-border hover:border-primary/40")
          }
        >
          <div className="text-sm font-semibold">📋 Rattaché à une mission</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            RDV contractualisé · prestation facturable
          </div>
        </button>
        <button
          type="button"
          onClick={() => onLinkTypeChange("standalone")}
          className={
            "text-left rounded-lg border-2 px-3 py-2.5 transition-all " +
            (linkType === "standalone"
              ? "border-primary bg-primary/5 shadow-soft"
              : "border-border hover:border-primary/40")
          }
        >
          <div className="text-sm font-semibold">⚡ Intervention ponctuelle</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            One-shot · pas de contrat
          </div>
        </button>
      </div>

      {/* Sélecteurs Mission + Prestation (si linkType=mission) */}
      {linkType === "mission" && (
        <div className="space-y-2">
          {isLoading && (
            <div className="text-xs text-muted-foreground italic">Chargement des missions…</div>
          )}

          {!isLoading && activeMissions.length === 0 && (
            <div className="text-xs rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 p-2.5 space-y-1">
              <div className="font-medium text-amber-900 dark:text-amber-100">
                Ce client n'a aucune mission active.
              </div>
              <div className="text-amber-700 dark:text-amber-300 text-[11px]">
                Crée une mission depuis sa fiche, ou bascule en "Intervention ponctuelle".
              </div>
              {clientId && (
                <a
                  href={`/clients/${clientId}/missions/new`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-1 text-[11px] text-amber-900 dark:text-amber-100 underline hover:no-underline"
                >
                  → Créer une mission (nouvel onglet)
                </a>
              )}
            </div>
          )}

          {!isLoading && activeMissions.length > 0 && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Mission *
                </Label>
                <select
                  value={missionId}
                  onChange={(e) => onMissionChange(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer hover:border-primary/40"
                  required
                >
                  <option value="">— Choisir une mission —</option>
                  {activeMissions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.billing_rhythm ? ` (${m.billing_rhythm})` : ""}
                    </option>
                  ))}
                  {missions.length > activeMissions.length && (
                    <optgroup label="Missions inactives">
                      {missions
                        .filter((m) => m.status !== "active")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.status}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {selectedMission && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Prestation contractualisée
                  </Label>
                  {prestations.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground italic bg-muted/40 rounded-md p-2">
                      Cette mission n'a aucune prestation. Ajoute-en une depuis la fiche client.
                    </div>
                  ) : (
                    <select
                      value={prestationId}
                      onChange={(e) => onPrestationChange(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm h-9 cursor-pointer hover:border-primary/40"
                    >
                      <option value="">— Aucune (sera précisé plus tard) —</option>
                      {prestations.map((p) => {
                        const price = Number(p.custom_price ?? p.base_price ?? 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.label} · {price.toFixed(2)} €
                            {p.billing_type ? ` · ${p.billing_type}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {linkType === "standalone" && (
        <div className="space-y-2">
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2.5">
            ⚡ RDV <strong>ponctuel</strong>. Ajoute une ou plusieurs prestations
            pour générer automatiquement une <strong>mission</strong> et un
            <strong> devis brouillon</strong>. Sans prestation, le RDV reste un
            simple one-shot.
          </div>

          {standalonePrestations.map((p, idx) => (
            <div
              key={idx}
              className="rounded-lg border bg-card p-2.5 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Prestation #{idx + 1}
                </Label>
                <button
                  type="button"
                  onClick={() => removePrestation(idx)}
                  className="text-[10px] text-rose-600 hover:text-rose-700 underline cursor-pointer"
                >
                  Retirer
                </button>
              </div>
              <select
                value={p.product_id ? String(p.product_id) : ""}
                onChange={(e) => pickProduct(idx, e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs h-8 cursor-pointer"
              >
                <option value="">— Libre (sans produit catalogue) —</option>
                {catalogProducts.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.code ? `${prod.code} · ` : ""}{prod.name}
                    {prod.price != null ? ` (${Number(prod.price).toFixed(2)} €)` : ""}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <Input
                  value={p.label}
                  onChange={(e) => updatePrestation(idx, { label: e.target.value })}
                  placeholder="Libellé de la prestation *"
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={p.unit_price ?? ""}
                  onChange={(e) =>
                    updatePrestation(idx, {
                      unit_price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Prix €"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full h-8 gap-1 text-[11px]"
            onClick={addPrestation}
          >
            + Ajouter une prestation
          </Button>
        </div>
      )}
    </div>
  );
}
