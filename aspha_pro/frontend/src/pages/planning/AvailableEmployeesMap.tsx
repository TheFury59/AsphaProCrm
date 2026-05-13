import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, MapPin, AlertTriangle, Filter, Users, Clock, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAvailableEmployees, type AvailableEmployee } from "@/hooks/use-planning-summary";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = L.icon({
  iconUrl, iconRetinaUrl: iconRetina, shadowUrl: iconShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [0, -41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function dotIcon(color: string, size = 22, highlight = false): L.DivIcon {
  const ring = highlight ? "0 0 0 6px rgba(16,185,129,0.25), " : "";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:${ring}0 2px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const CLIENT_ICON = dotIcon("#ef4444", 26);
const AVAILABLE_ICON = dotIcon("#10b981", 22);
const CONFLICT_ICON = dotIcon("#f59e0b", 22);
const SELECTED_ICON = dotIcon("#10b981", 28, true);

// Options de rayon en km
const RADIUS_OPTIONS = [
  { km: 2, label: "2 km" },
  { km: 5, label: "5 km" },
  { km: 10, label: "10 km" },
  { km: 20, label: "20 km" },
  { km: 50, label: "50 km" },
  { km: null, label: "Tous" },
] as const;

/**
 * Re-fitte la carte pour englober le cercle (client + rayon).
 *
 * ⚠️ On NE PAS appeler `L.circle(center).getBounds()` car ce calcul requiert
 * que le circle soit attaché à une map active avec une projection initialisée
 * (sinon `layerPointToLatLng undefined` → crash).
 *
 * On calcule donc les bounds manuellement : 1° de latitude ≈ 111 km, et 1° de
 * longitude ≈ 111 km × cos(lat). Suffisant pour fitBounds approximatif.
 */
function FitToCircle({ centerLat, centerLng, radiusKm }: {
  centerLat: number;
  centerLng: number;
  radiusKm: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;  // guard : map pas encore prête
    try {
      if (radiusKm) {
        const km = radiusKm;
        const latOffset = km / 111;
        const cosLat = Math.cos((centerLat * Math.PI) / 180);
        const lngOffset = km / (111 * (cosLat || 1));
        const bounds = L.latLngBounds(
          [centerLat - latOffset, centerLng - lngOffset],
          [centerLat + latOffset, centerLng + lngOffset],
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } else {
        map.setView([centerLat, centerLng], 10);
      }
    } catch (e) {
      // Si la map n'est pas dans un state stable (transitions du dialog),
      // on ignore silencieusement plutôt que de crasher la page.
      console.warn("FitToCircle: skipped fitBounds", e);
    }
  }, [map, centerLat, centerLng, radiusKm]);
  return null;
}

/**
 * Carte + liste pour aider à choisir un intervenant lors de la création d'un RDV.
 *
 * Workflow attendu par le user :
 *  1. Le client est sélectionné → son adresse géocodée s'affiche en rouge sur la map
 *  2. La date/heure est définie → on calcule les conflits horaires
 *  3. Filtre rayon (2/5/10/20/50 km ou tous) → cercle dessiné autour du client
 *  4. Liste à droite triée par : disponibilité ASC, distance ASC
 *  5. Hover sur un intervenant → highlight sur la carte
 *  6. Clic → sélection → bouton "Affecter cet intervenant"
 */
export function AvailableEmployeesMap({
  startDatetime, endDatetime, clientId, onAssign,
}: {
  startDatetime: string;
  endDatetime: string;
  clientId: number;
  onAssign: (employeeId: number) => void;
}) {
  const { data, isLoading } = useAvailableEmployees({
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    client_id: clientId,
  });

  const [radiusKm, setRadiusKm] = useState<number | null>(10);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4 animate-pulse" />
          Calcul des disponibilités…
        </div>
      </div>
    );
  }

  if (!data?.client_address) {
    return (
      <div className="rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium text-sm">Adresse client non géocodée</div>
            <p className="text-xs text-muted-foreground">
              Ajoute une adresse au client (fiche → onglet Adresses) pour activer la carte
              et le calcul de distance. L'adresse est géocodée automatiquement via BAN.gouv.fr.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Cast en number + stabilisation pour ne pas re-créer un nouveau tuple à
  // chaque render (sinon MapContainer reçoit un nouveau `center` prop et peut
  // re-initialiser la map).
  const lat = Number(data.client_address.lat);
  const lng = Number(data.client_address.lng);
  const clientPos = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);
  const candidates = data.candidates;

  // Filtre par rayon (côté frontend, sur les distances déjà calculées par le backend)
  // ⚠️ distance_km arrive parfois en string (Laravel decimal cast) → cast Number()
  const filtered = useMemo(() => candidates.filter((c: AvailableEmployee) => {
    if (radiusKm === null) return true;
    if (c.distance_km === null || c.distance_km === undefined) return false;
    return Number(c.distance_km) <= radiusKm;
  }).filter((c: AvailableEmployee) => !hideUnavailable || !c.has_conflict),
  [candidates, radiusKm, hideUnavailable]);

  const availableCount = filtered.filter((c: AvailableEmployee) => !c.has_conflict).length;
  const conflictCount = filtered.filter((c: AvailableEmployee) => c.has_conflict).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-3 h-[min(560px,calc(88vh-260px))] min-h-[400px]">
      {/* === Map === */}
      <div className="rounded-xl overflow-hidden border bg-muted relative">
        <MapContainer center={clientPos} zoom={11} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <FitToCircle centerLat={lat} centerLng={lng} radiusKm={radiusKm} />

          {/* Cercle de rayon autour du client */}
          {radiusKm && (
            <Circle
              center={clientPos}
              radius={radiusKm * 1000}
              pathOptions={{
                color: "#10b981",
                fillColor: "#10b981",
                fillOpacity: 0.06,
                weight: 2,
                dashArray: "8 6",
              }}
            />
          )}

          {/* Marker client (rouge) */}
          <Marker position={clientPos} icon={CLIENT_ICON}>
            <Popup>
              <strong>Client</strong><br />
              {data.client_address.address ?? "Adresse"}
              {data.client_address.city && <><br />{data.client_address.city}</>}
            </Popup>
          </Marker>

          {/* Intervenants — cast Number() au cas où Laravel renvoie en string */}
          {filtered.map((c) => {
            const empLat = c.employee_lat !== null && c.employee_lat !== undefined ? Number(c.employee_lat) : null;
            const empLng = c.employee_lng !== null && c.employee_lng !== undefined ? Number(c.employee_lng) : null;
            if (empLat === null || empLng === null || isNaN(empLat) || isNaN(empLng)) return null;
            const isSelected = selected === c.employee_id || hovered === c.employee_id;
            const icon = isSelected ? SELECTED_ICON : (c.has_conflict ? CONFLICT_ICON : AVAILABLE_ICON);
            return (
              <Marker
                key={c.employee_id}
                position={[empLat, empLng]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelected(c.employee_id),
                }}
              >
                <Popup>
                  <strong>{c.employee_name}</strong><br />
                  {c.has_conflict ? (
                    <span className="text-orange-600">⚠ Conflit horaire</span>
                  ) : (
                    <span className="text-emerald-600">✓ Disponible</span>
                  )}
                  {c.distance_km !== null && (
                    <><br />{c.distance_km} km · {c.duration_minutes} min</>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Légende flottante */}
        <div className="absolute bottom-3 left-3 bg-card/95 backdrop-blur-sm rounded-lg shadow-soft p-2.5 text-[10px] space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>Client</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Disponible ({availableCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
            <span>Conflit horaire ({conflictCount})</span>
          </div>
        </div>
      </div>

      {/* === Sidebar liste intervenants === */}
      <div className="rounded-xl bg-card shadow-soft flex flex-col overflow-hidden">
        {/* Header avec filtre rayon */}
        <div className="border-b p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 text-muted-foreground">
              <Filter className="h-3 w-3" />
              Rayon de recherche
            </div>
            <button
              onClick={() => setHideUnavailable((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                hideUnavailable
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted-foreground/20"
              }`}
            >
              {hideUnavailable ? "✓ Dispo uniquement" : "Tous"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.km ?? "all"}
                onClick={() => setRadiusKm(opt.km)}
                className={`text-[11px] px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  radiusKm === opt.km
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            <strong className="text-foreground">{filtered.length}</strong> intervenant{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}
            {radiusKm !== null && ` dans ${radiusKm} km`}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto divide-y">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Aucun intervenant dans ce rayon. Élargis le filtre ou désactive "Dispo uniquement".
            </div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.employee_id}
                onClick={() => setSelected(c.employee_id)}
                onMouseEnter={() => setHovered(c.employee_id)}
                onMouseLeave={() => setHovered(null)}
                className={`w-full px-3 py-2.5 text-left hover:bg-muted/40 transition-colors cursor-pointer ${
                  selected === c.employee_id ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                    c.has_conflict ? "bg-orange-500" : "bg-emerald-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{c.employee_name}</span>
                      {i === 0 && !c.has_conflict && c.distance_km !== null && (
                        <Badge variant="default" className="text-[9px] h-4 px-1 bg-gradient-aspha text-white border-0">
                          ★ Top
                        </Badge>
                      )}
                    </div>

                    {c.distance_km !== null ? (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{c.distance_km} km
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Navigation className="h-2.5 w-2.5" />{c.duration_minutes} min
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground italic mt-0.5">
                        Non géolocalisé
                      </div>
                    )}

                    {c.has_conflict && c.conflicts.length > 0 && (
                      <div className="mt-1 text-[10px] text-orange-600 dark:text-orange-400 space-y-0.5">
                        {c.conflicts.map((cf) => (
                          <div key={cf.intervention_id} className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span>RDV {cf.start_time}–{cf.end_time}</span>
                            {cf.client_code && <span>· {cf.client_code}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selected === c.employee_id && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* CTA Affecter */}
        {selected && (
          <div className="border-t p-2.5 bg-muted/30">
            <Button
              size="sm"
              className="w-full bg-gradient-aspha shadow-brand text-white border-0 hover:opacity-95"
              onClick={() => onAssign(selected)}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Affecter cet intervenant
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
