import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, MapPin, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAvailableEmployees } from "@/hooks/use-planning-summary";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = L.icon({
  iconUrl, iconRetinaUrl: iconRetina, shadowUrl: iconShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [0, -41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function dotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const CLIENT_ICON = dotIcon("#ef4444");
const AVAILABLE_ICON = dotIcon("#10b981");
const CONFLICT_ICON = dotIcon("#f59e0b");

/**
 * Affiche une carte avec :
 *  - Le client (marker rouge)
 *  - Tous les intervenants actifs (vert = dispo, orange = conflit) avec
 *    distance + temps de trajet calculés
 *  - Liste à droite triée par distance, bouton "Affecter" pour chacun
 *
 * Utilisé dans le dialog de création d'intervention pour aider à choisir
 * l'intervenant le plus proche disponible.
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

  const [selected, setSelected] = useState<number | null>(null);

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Calcul des disponibilités…</div>;
  }

  if (!data?.client_address) {
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
        <span>Le client n'a pas d'adresse géocodée. La carte et les distances ne peuvent pas être calculées.</span>
      </div>
    );
  }

  const candidates = data.candidates;
  const clientPos: [number, number] = [data.client_address.lat, data.client_address.lng];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3 h-[420px]">
      <div className="rounded-md overflow-hidden border">
        <MapContainer center={clientPos} zoom={11} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <Marker position={clientPos} icon={CLIENT_ICON}>
            <Popup><strong>Client</strong><br />{data.client_address.address}</Popup>
          </Marker>
          {candidates.filter((c) => c.employee_lat && c.employee_lng).map((c) => (
            <Marker
              key={c.employee_id}
              position={[c.employee_lat!, c.employee_lng!]}
              icon={c.has_conflict ? CONFLICT_ICON : AVAILABLE_ICON}
            >
              <Popup>
                <strong>{c.employee_name}</strong><br />
                {c.has_conflict ? "⚠ Conflit horaire" : "✓ Disponible"}<br />
                {c.distance_km !== null && `${c.distance_km} km · ${c.duration_minutes} min`}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="border rounded-md overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b text-xs font-medium">
          {candidates.filter((c) => !c.has_conflict).length} disponible{candidates.filter((c) => !c.has_conflict).length > 1 ? "s" : ""}
        </div>
        <div className="overflow-y-auto flex-1 divide-y">
          {candidates.map((c) => (
            <button
              key={c.employee_id}
              onClick={() => setSelected(c.employee_id)}
              className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${selected === c.employee_id ? "bg-accent" : ""}`}
            >
              <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${c.has_conflict ? "bg-orange-500" : "bg-emerald-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.employee_name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {c.has_conflict ? (
                    <span>Conflit horaire</span>
                  ) : c.distance_km !== null ? (
                    <>
                      <MapPin className="h-2.5 w-2.5" />
                      {c.distance_km} km · {c.duration_minutes} min
                    </>
                  ) : (
                    <span>Non géolocalisé</span>
                  )}
                </div>
              </div>
              {selected === c.employee_id && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
        {selected && (
          <div className="border-t p-2">
            <Button size="sm" className="w-full" onClick={() => onAssign(selected)}>
              Affecter cet intervenant
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
