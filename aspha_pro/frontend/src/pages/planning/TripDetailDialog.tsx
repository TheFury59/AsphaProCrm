import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Home, Building2, ArrowDown, Clock, Route, Car, Wallet, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Trip } from "@/hooks/use-planning-summary";

/**
 * Dialog détaillé d'une journée de trajets pour un intervenant.
 *
 * Layout 2/3 + 1/3 (en plein écran sur mobile) :
 *  - Gauche : carte Leaflet montrant tous les waypoints + lignes entre
 *  - Droite : timeline verticale ordonnée chronologiquement avec
 *    alternance trajet / RDV (durée, distance, payé/non payé)
 *
 * Le dialog est ouvert depuis TripSummaryPanel (click sur une carte
 * intervenant) avec les trajets pré-filtrés pour cet intervenant.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  trips: Trip[];  // déjà filtrés sur l'employee_id concerné
  /** Date affichée dans le header (ISO yyyy-MM-dd). Si null, "Toute la période". */
  date?: string | null;
};

// Icônes de waypoint — domicile (vert) vs client (bleu pour le 1er, dégradé pour la suite)
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

export function TripDetailDialog({ open, onClose, employeeName, trips, date }: Props) {
  // Construit la liste des waypoints uniques dans l'ordre chronologique
  // (un trajet = from -> to ; on chaîne pour éviter les doublons consécutifs).
  const waypoints = useMemo(() => {
    if (trips.length === 0) return [] as Array<{
      lat: number; lng: number; label: string; kind: "home" | "client"; address: string | null; time: string | null;
    }>;
    const points: Array<{ lat: number; lng: number; label: string; kind: "home" | "client"; address: string | null; time: string | null }> = [];

    trips.forEach((t, idx) => {
      const from = t.from_address;
      const to = t.to_address;
      // Ajoute "from" si absent du dernier point ajouté
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
  }, [trips]);

  // Centre + zoom : moyenne des waypoints, fallback Paris
  const center: [number, number] = waypoints.length > 0
    ? [
        waypoints.reduce((s, p) => s + p.lat, 0) / waypoints.length,
        waypoints.reduce((s, p) => s + p.lng, 0) / waypoints.length,
      ]
    : [48.8566, 2.3522];

  // Lignes entre waypoints — pointillés rouges pour non payé, plein vert pour payé
  const polylines = useMemo(() => {
    return trips
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
  }, [trips]);

  // Totaux récap pour l'header
  const totalKm = trips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const totalMin = trips.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
  const paidKm = trips.filter((t) => t.is_paid).reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const unpaidKm = trips.filter((t) => !t.is_paid).reduce((s, t) => s + (t.distance_km ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[95vw] sm:!max-w-[1400px] h-[88vh] max-h-[88vh] p-0 flex flex-col overflow-hidden gap-0 sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl tracking-tight flex items-center gap-2">
                <Route className="h-5 w-5 text-primary" />
                Journée de {employeeName}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {date && (
                  <span className="font-medium text-foreground">
                    {format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  {totalKm.toFixed(1)} km · {formatMin(totalMin)}
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <Wallet className="h-3 w-3" />
                  Payé : {paidKm.toFixed(1)} km
                </span>
                <span className="flex items-center gap-1 text-rose-600">
                  Non payé : {unpaidKm.toFixed(1)} km
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 -mr-2"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
          {/* ============================================================ */}
          {/* CARTE (gauche)                                                */}
          {/* ============================================================ */}
          <div className="relative min-h-[300px] lg:min-h-0 border-r">
            {waypoints.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Aucun trajet à afficher.
              </div>
            ) : (
              <MapContainer
                center={center}
                zoom={11}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Polylines : 1 ligne par trajet */}
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

                {/* Waypoints */}
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

          {/* ============================================================ */}
          {/* TIMELINE (droite)                                             */}
          {/* ============================================================ */}
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {trips.length === 0 && (
                <div className="text-sm text-muted-foreground italic text-center py-8">
                  Aucun trajet calculé pour ce jour.
                </div>
              )}

              {trips.map((t, idx) => (
                <div key={idx} className="space-y-1.5">
                  {/* Waypoint départ (affiché seulement pour le premier trajet de chaque chaîne) */}
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

                  {/* Trajet */}
                  <TripBlock trip={t} />

                  {/* Waypoint arrivée */}
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
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
