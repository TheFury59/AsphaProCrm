import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, eachDayOfInterval, getDay, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Home, Building2, ArrowDown, Clock, Route, Car, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrips, type Trip } from "@/hooks/use-planning-summary";

/**
 * Dialog détaillé des trajets d'un intervenant avec navigation par période.
 *
 * 3 modes de visualisation :
 *  - **Jour** : un seul jour, carte + timeline complète
 *  - **Semaine** : lun→dim, chips par jour cliquables pour filtrer la carte
 *  - **Mois** : mois calendaire, chips par jour avec totaux quotidiens
 *
 * Le composant fetch ses propres trips selon la fenêtre courante — il n'est
 * plus dépendant de la fenêtre du calendrier parent. Ça permet d'afficher
 * un total mensuel même si le calendrier admin n'affiche que 2 semaines.
 *
 * Layout :
 *  - Header : titre + toggle scope + nav prev/next + totaux
 *  - Ligne de chips jours (en mode week/month) — click = filtre carte
 *  - Carte Leaflet (gauche) + Timeline verticale (droite)
 */
type Props = {
  open: boolean;
  onClose: () => void;
  employeeId: number | null;
  employeeName: string;
  /** Date initialement focalisée (yyyy-MM-dd). À défaut, aujourd'hui. */
  initialDate?: string | null;
};

type Scope = "day" | "week" | "month";

// Icônes de waypoint — domicile (vert) vs client (bleu numéroté)
function waypointIcon(kind: "home" | "client", index?: number): L.DivIcon {
  const color = kind === "home" ? "#10b981" : "#3b82f6";
  const label = kind === "home" ? "🏠" : String((index ?? 0) + 1);
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Calcule la fenêtre [from, to] (yyyy-MM-dd) selon le scope autour d'une
 * date pivot. firstDay=1 (lundi) pour la semaine — convention FR.
 */
function windowFor(scope: Scope, anchor: Date): { from: string; to: string } {
  if (scope === "day") return { from: ymd(anchor), to: ymd(anchor) };
  if (scope === "week") {
    return {
      from: ymd(startOfWeek(anchor, { weekStartsOn: 1 })),
      to: ymd(endOfWeek(anchor, { weekStartsOn: 1 })),
    };
  }
  return { from: ymd(startOfMonth(anchor)), to: ymd(endOfMonth(anchor)) };
}

export function TripDetailDialog({ open, onClose, employeeId, employeeName, initialDate }: Props) {
  const [scope, setScope] = useState<Scope>("day");
  const [anchor, setAnchor] = useState<Date>(() => initialDate ? parseISO(initialDate) : new Date());
  // Quand scope=week/month : permet de filtrer la carte sur 1 seul jour.
  // null = tous les jours de la fenêtre affichés.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Resync l'anchor quand le dialog s'ouvre avec une nouvelle date initiale
  useEffect(() => {
    if (open && initialDate) {
      setAnchor(parseISO(initialDate));
      setScope("day");
      setSelectedDay(null);
    }
  }, [open, initialDate]);

  // Reset selectedDay quand on change de scope (sinon ID de jour orphelin)
  useEffect(() => { setSelectedDay(null); }, [scope]);

  const { from, to } = useMemo(() => windowFor(scope, anchor), [scope, anchor]);
  const { data, isLoading } = useTrips({
    from, to,
    employee_id: employeeId ?? undefined,
  });

  // Tous les trips de la fenêtre — déjà filtrés server-side sur l'employee_id
  const allTrips: Trip[] = useMemo(() => data?.trips ?? [], [data]);

  // Trips affichés sur la carte/timeline : selectedDay si défini, sinon tout
  const displayedTrips = useMemo(() => {
    if (!selectedDay) return allTrips;
    return allTrips.filter((t) => t.to_start.slice(0, 10) === selectedDay);
  }, [allTrips, selectedDay]);

  // Liste des jours de la fenêtre pour la vue semaine (7 cases lun→dim).
  // En vue mois on utilise monthGridDays() qui complète avec les jours
  // adjacents pour aligner sur une grille 7×N propre.
  const days = useMemo(() => {
    if (scope !== "week") return [];
    return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  }, [scope, from, to]);

  // Totaux par jour (pour les chips) — calculés depuis allTrips
  const tripsByDay = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const t of allTrips) {
      const k = t.to_start.slice(0, 10);
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return map;
  }, [allTrips]);

  // Totaux globaux période courante
  const totals = useMemo(() => sumTrips(allTrips), [allTrips]);
  // Totaux du jour sélectionné (si applicable)
  const dayTotals = useMemo(() => sumTrips(displayedTrips), [displayedTrips]);

  // Navigation prev/next selon scope
  const navigate = (dir: -1 | 1) => {
    setSelectedDay(null);
    if (scope === "day") setAnchor((a) => addDays(a, dir));
    else if (scope === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => addMonths(a, dir));
  };
  const goToday = () => {
    setSelectedDay(null);
    setAnchor(new Date());
  };

  // Label de la période courante
  const periodLabel = useMemo(() => {
    if (scope === "day") return format(anchor, "EEEE d MMMM yyyy", { locale: fr });
    if (scope === "week") {
      return `${format(parseISO(from), "d MMM", { locale: fr })} → ${format(parseISO(to), "d MMM yyyy", { locale: fr })}`;
    }
    return format(anchor, "MMMM yyyy", { locale: fr });
  }, [scope, anchor, from, to]);

  // === Carte : waypoints + polylines à partir de displayedTrips ===
  const waypoints = useMemo(() => buildWaypoints(displayedTrips), [displayedTrips]);
  const center: [number, number] = waypoints.length > 0
    ? [
        waypoints.reduce((s, p) => s + p.lat, 0) / waypoints.length,
        waypoints.reduce((s, p) => s + p.lng, 0) / waypoints.length,
      ]
    : [48.8566, 2.3522];
  const polylines = useMemo(() => {
    return displayedTrips
      .filter((t) => t.from_address.latitude && t.to_address.latitude)
      .map((t) => ({
        positions: [
          [t.from_address.latitude!, t.from_address.longitude!],
          [t.to_address.latitude!, t.to_address.longitude!],
        ] as [number, number][],
        is_paid: t.is_paid,
        is_home: t.is_home_origin,
        duration: t.duration_minutes,
        distance: t.distance_km,
      }));
  }, [displayedTrips]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[95vw] sm:!max-w-[1400px] h-[90vh] max-h-[90vh] p-0 flex flex-col overflow-hidden gap-0 sm:rounded-2xl">
        {/* ===== HEADER ===== */}
        <DialogHeader className="px-6 pt-4 pb-3 border-b shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <DialogTitle className="text-xl tracking-tight flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              Trajets de {employeeName}
            </DialogTitle>

            {/* Toggle scope */}
            <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
              {(["day", "week", "month"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors " +
                    (scope === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {s === "day" ? "Jour" : s === "week" ? "Semaine" : "Mois"}
                </button>
              ))}
            </div>
          </div>

          {/* Ligne navigation + label période */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="h-7 px-2">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} className="h-7 px-2 text-xs">
              Aujourd'hui
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)} className="h-7 px-2">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-medium ml-1 capitalize">{periodLabel}</span>
          </div>

          {/* Totaux de la période */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-medium text-foreground">
              Total {scope === "day" ? "du jour" : scope === "week" ? "de la semaine" : "du mois"} :
            </span>
            <span className="flex items-center gap-1">
              <Car className="h-3 w-3" />
              {totals.totalKm.toFixed(1)} km · {formatMin(totals.totalMin)}
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <Wallet className="h-3 w-3" />
              Payé : {totals.paidKm.toFixed(1)} km · {formatMin(totals.paidMin)}
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              Non payé : {totals.unpaidKm.toFixed(1)} km · {formatMin(totals.unpaidMin)}
            </span>
            {selectedDay && (
              <span className="ml-auto pl-3 border-l text-muted-foreground">
                <span className="font-medium text-foreground">Jour filtré :</span>{" "}
                {dayTotals.totalKm.toFixed(1)} km · {formatMin(dayTotals.totalMin)}
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="ml-2 text-primary hover:underline"
                >
                  Tout afficher
                </button>
              </span>
            )}
          </div>

          {/* Grille jours (semaine / mois) — cliquables pour filtrer la carte.
              Mois : grille calendrier 7 cols × 5-6 lignes avec offset pour
              que le 1er soit aligné sur le bon jour de la semaine.
              Semaine : grille 7 cols sur 1 ligne (lun→dim). */}
          {scope === "week" && (
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => (
                <DayCell
                  key={ymd(d)}
                  date={d}
                  trips={tripsByDay.get(ymd(d)) ?? []}
                  isSelected={selectedDay === ymd(d)}
                  isOutside={false}
                  onClick={() => setSelectedDay(selectedDay === ymd(d) ? null : ymd(d))}
                />
              ))}
            </div>
          )}
          {scope === "month" && (
            <div className="grid grid-cols-7 gap-1 max-h-[260px] overflow-y-auto">
              {/* Entêtes jours de la semaine */}
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
                <div key={label} className="text-[9px] uppercase tracking-wider text-muted-foreground text-center pb-0.5">
                  {label}
                </div>
              ))}
              {monthGridDays(anchor).map((d, i) => (
                <DayCell
                  key={`${ymd(d)}-${i}`}
                  date={d}
                  trips={tripsByDay.get(ymd(d)) ?? []}
                  isSelected={selectedDay === ymd(d)}
                  isOutside={!isSameMonth(d, anchor)}
                  compact
                  onClick={() => setSelectedDay(selectedDay === ymd(d) ? null : ymd(d))}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        {/* ===== CONTENU : CARTE + TIMELINE ===== */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
          {/* Carte — min-h-0 obligatoire pour qu'une cellule grid puisse
              shrink en dessous de sa hauteur intrinsèque (Leaflet sinon
              déborde) */}
          <div className="relative min-h-[300px] lg:min-h-0 border-r overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Chargement des trajets…
              </div>
            ) : waypoints.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Aucun trajet à afficher{selectedDay ? " pour ce jour." : " sur cette période."}
              </div>
            ) : (
              <MapContainer
                key={`${from}-${to}-${selectedDay ?? "all"}`}  // remount = recentrage propre
                center={center}
                zoom={11}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {polylines.map((p, i) => (
                  <Polyline
                    key={i}
                    positions={p.positions}
                    pathOptions={{
                      color: p.is_paid ? "#10b981" : "#ef4444",
                      weight: 3.5,
                      opacity: 0.85,
                      dashArray: p.is_paid ? undefined : "8,6",
                    }}
                  >
                    <LeafletTooltip>
                      {p.duration ?? "?"} min · {p.distance?.toFixed(1) ?? "?"} km
                      {!p.is_paid && (p.is_home ? " (domicile)" : " (pause > 45min)")}
                    </LeafletTooltip>
                  </Polyline>
                ))}
                {waypoints.map((w, i) => (
                  <Marker
                    key={`${w.lat}-${w.lng}-${i}`}
                    position={[w.lat, w.lng]}
                    icon={waypointIcon(w.kind, w.kind === "client" ? i - waypoints.filter((p, idx) => idx < i && p.kind === "home").length : undefined)}
                  >
                    <LeafletTooltip permanent={false} direction="top">
                      <div className="text-xs">
                        <div className="font-semibold">{w.label}</div>
                        {w.time && <div className="text-muted-foreground">{w.time}</div>}
                        {w.address && <div className="text-muted-foreground">{w.address}</div>}
                      </div>
                    </LeafletTooltip>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>

          {/* Timeline — overflow-y-auto natif sur la cellule grid.
              `<ScrollArea h-full>` de shadcn ne fonctionne pas ici car les
              cellules grid n'ont pas de hauteur définie ; il faut `min-h-0`
              + overflow-y-auto directement sur le div pour que le contenu
              scrolle au lieu de pousser la cellule. */}
          <div className="min-h-0 overflow-y-auto">
            <div className="p-4 space-y-3">
              {displayedTrips.length === 0 && !isLoading && (
                <div className="text-sm text-muted-foreground italic text-center py-8">
                  Aucun trajet sur cette période.
                </div>
              )}
              {/* Timeline groupée par jour (utile en mode semaine/mois sans filtre) */}
              {groupTripsByDay(displayedTrips).map(({ day, trips }) => (
                <div key={day} className="space-y-1.5">
                  {scope !== "day" && !selectedDay && (
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                      {format(parseISO(day), "EEEE d MMMM", { locale: fr })}
                    </div>
                  )}
                  {trips.map((t, idx) => (
                    <div key={`${day}-${idx}`} className="space-y-1.5">
                      {(idx === 0 || trips[idx - 1].to_address.latitude !== t.from_address.latitude) && (
                        <WaypointBlock
                          kind={t.is_home_origin ? "home" : "client"}
                          label={t.from_address.label}
                          address={t.from_address.address}
                          city={t.from_address.city}
                          time={t.from_end ? format(new Date(t.from_end), "HH:mm") : null}
                          timeLabel="Départ"
                        />
                      )}
                      <TripBlock trip={t} />
                      <WaypointBlock
                        kind="client"
                        label={t.to_address.label}
                        address={t.to_address.address}
                        city={t.to_address.city}
                        time={format(new Date(t.to_start), "HH:mm")}
                        timeLabel="Arrivée"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// Helpers
// =========================================================================

function sumTrips(trips: Trip[]): {
  totalKm: number; totalMin: number;
  paidKm: number; paidMin: number;
  unpaidKm: number; unpaidMin: number;
} {
  let totalKm = 0, totalMin = 0, paidKm = 0, paidMin = 0, unpaidKm = 0, unpaidMin = 0;
  for (const t of trips) {
    const km = t.distance_km ?? 0;
    const min = t.duration_minutes ?? 0;
    totalKm += km;
    totalMin += min;
    if (t.is_paid) { paidKm += km; paidMin += min; }
    else { unpaidKm += km; unpaidMin += min; }
  }
  return { totalKm, totalMin, paidKm, paidMin, unpaidKm, unpaidMin };
}

function buildWaypoints(trips: Trip[]): Array<{
  lat: number; lng: number; label: string; kind: "home" | "client"; address: string | null; time: string | null;
}> {
  if (trips.length === 0) return [];
  const points: Array<{ lat: number; lng: number; label: string; kind: "home" | "client"; address: string | null; time: string | null }> = [];
  trips.forEach((t, idx) => {
    const from = t.from_address;
    const to = t.to_address;
    const last = points[points.length - 1];
    const fromKind: "home" | "client" = t.is_home_origin ? "home" : "client";
    if (from.latitude !== null && from.longitude !== null) {
      if (!last || last.lat !== from.latitude || last.lng !== from.longitude) {
        points.push({
          lat: from.latitude,
          lng: from.longitude,
          label: from.label,
          kind: fromKind,
          address: from.address ?? null,
          time: idx === 0 && t.from_end ? format(new Date(t.from_end), "HH:mm") : null,
        });
      }
    }
    if (to.latitude !== null && to.longitude !== null) {
      points.push({
        lat: to.latitude,
        lng: to.longitude,
        label: to.label,
        kind: "client",
        address: to.address ?? null,
        time: format(new Date(t.to_start), "HH:mm"),
      });
    }
  });
  return points;
}

function groupTripsByDay(trips: Trip[]): Array<{ day: string; trips: Trip[] }> {
  const map = new Map<string, Trip[]>();
  for (const t of trips) {
    const k = t.to_start.slice(0, 10);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, trips]) => ({ day, trips }));
}

/**
 * Construit une grille calendrier 7×N pour le mois d'`anchor`.
 * Inclut les jours adjacents (mois précédent / suivant) pour compléter
 * la 1ère et la dernière semaine — comme un mini-calendrier classique.
 * weekStartsOn=1 (lundi) — convention FR.
 */
function monthGridDays(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

/**
 * Cellule de jour cliquable — utilisée à la fois en mode semaine
 * (taille normale) et mois (mode compact pour tenir dans 7 colonnes).
 *
 *  - `isOutside` (mois) : jour hors du mois courant, grisé
 *  - `isSelected` : filtre actif sur ce jour, fond primary
 *  - has trips : montre total km du jour
 */
function DayCell({
  date, trips, isSelected, isOutside, compact, onClick,
}: {
  date: Date;
  trips: Trip[];
  isSelected: boolean;
  isOutside: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const dayKm = trips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const hasTrips = trips.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title={hasTrips ? `${trips.length} trajet${trips.length > 1 ? "s" : ""} · ${dayKm.toFixed(1)} km` : "Aucun trajet"}
      className={
        (compact ? "px-1 py-1 text-[9px]" : "px-2 py-1.5 text-[10px]") +
        " rounded-md border leading-tight transition-all text-center cursor-pointer " +
        (isSelected
          ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30"
          : isOutside
          ? "bg-transparent text-muted-foreground/40 border-transparent hover:bg-muted/30"
          : hasTrips
          ? "bg-card hover:border-primary/40 hover:bg-muted/50"
          : "bg-muted/20 text-muted-foreground/70 border-dashed hover:bg-muted/40")
      }
    >
      {!compact && (
        <div className="font-semibold uppercase">{format(date, "EEE", { locale: fr })}</div>
      )}
      <div className={(compact ? "text-[11px]" : "text-[13px]") + " font-bold tabular-nums"}>
        {format(date, "d")}
      </div>
      {hasTrips && (
        <div className={(compact ? "text-[8px]" : "text-[9px]") + " tabular-nums opacity-80 mt-0.5"}>
          {dayKm.toFixed(0)} km
        </div>
      )}
    </button>
  );
}

// silence unused (getDay réservé pour usages futurs, ex: highlight weekend)
void getDay;

// =========================================================================
// Sub-blocks
// =========================================================================

function WaypointBlock({ kind, label, address, city, time, timeLabel }: {
  kind: "home" | "client";
  label: string;
  address: string | null;
  city: string | null;
  time: string | null;
  timeLabel: string;
}) {
  const Icon = kind === "home" ? Home : Building2;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-card border shadow-sm">
      <div
        className={
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 " +
          (kind === "home" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700")
        }
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {(address || city) && (
          <div className="text-[11px] text-muted-foreground truncate">
            {[address, city].filter(Boolean).join(", ")}
          </div>
        )}
      </div>
      {time && (
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{timeLabel}</div>
          <div className="text-sm font-mono font-semibold">{time}</div>
        </div>
      )}
    </div>
  );
}

function TripBlock({ trip }: { trip: Trip }) {
  return (
    <div className="flex items-center gap-3 pl-3 py-1.5">
      <div className="flex flex-col items-center">
        <ArrowDown className={"h-3 w-3 " + (trip.is_paid ? "text-emerald-600" : "text-rose-600")} />
        <div
          className={
            "w-0.5 h-6 " +
            (trip.is_paid ? "bg-emerald-500" : "bg-rose-500 [background:repeating-linear-gradient(to_bottom,theme(colors.rose.500)_0,theme(colors.rose.500)_4px,transparent_4px,transparent_8px)]")
          }
        />
      </div>
      <div className="flex-1 flex items-center gap-2 text-xs">
        <Badge
          variant={trip.is_paid ? "default" : "outline"}
          className={
            "text-[10px] h-5 " +
            (trip.is_paid
              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
              : "bg-rose-50 text-rose-700 border-rose-300")
          }
        >
          {trip.is_paid ? "Payé" : (trip.is_home_origin ? "Domicile (non payé)" : "Pause > 45min")}
        </Badge>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatMin(trip.duration_minutes ?? 0)}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Car className="h-3 w-3" />
          {trip.distance_km?.toFixed(1) ?? "?"} km
        </span>
        {!trip.is_home_origin && (
          <span className="text-muted-foreground ml-auto">
            Pause : {formatMin(trip.gap_minutes)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatMin(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}
