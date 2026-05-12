import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useInterventions } from "@/hooks/use-phase3";
import { useEmployees } from "@/hooks/use-employees";
import { useClients } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Fix icônes Leaflet en bundling Vite
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = L.icon({
  iconUrl, iconRetinaUrl: iconRetina, shadowUrl: iconShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [0, -41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function makeColorIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const CLIENT_ICON = makeColorIcon("#3b82f6");
const EMPLOYEE_ICON = makeColorIcon("#8b5cf6");
const INTERVENTION_ICON = makeColorIcon("#10b981");

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (points.length > 0) {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
  return null;
}

export function MapPage() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const { data: clientsData } = useClients({ per_page: 200 });
  const { data: employeesData } = useEmployees({ per_page: 200 });
  const interventions = useInterventions({ from: today, to: tomorrow });

  const clients = clientsData?.data ?? [];
  const employees = employeesData?.data ?? [];

  // Construction des points : clients (depuis adresses), intervenants (geo), interventions (resolus via client)
  const points = useMemo(() => {
    const pts: Array<{ lat: number; lng: number; type: "client" | "employee" | "intervention"; label: string; details?: string }> = [];

    // Clients : prendre la première adresse avec géo
    clients.forEach((c) => {
      const addr = c.addresses?.find((a) => a.lat && a.lng);
      if (addr && addr.lat && addr.lng) {
        pts.push({
          lat: addr.lat, lng: addr.lng, type: "client",
          label: c.company?.company_name ?? c.display_name,
          details: `${addr.line1}, ${addr.postal_code} ${addr.city}`,
        });
      }
    });

    // Intervenants : adresse perso geo
    employees.forEach((e) => {
      if (e.address?.lat && e.address?.lng) {
        pts.push({
          lat: e.address.lat, lng: e.address.lng, type: "employee",
          label: e.full_name,
          details: `${e.address.line1 ?? ""}, ${e.address.postal_code ?? ""} ${e.address.city ?? ""}`.trim(),
        });
      }
    });

    return pts;
  }, [clients, employees]);

  const interventionEvents = interventions.data ?? [];

  return (
    <div>
      <PageHeader
        title="Carte"
        description={`Clients (${clients.length}), Intervenants (${employees.length}), Interventions du jour (${interventionEvents.length})`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-0 h-[75vh]">
            {points.length > 0 ? (
              <MapContainer
                center={[points[0].lat, points[0].lng]}
                zoom={11}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitToMarkers points={points.map((p) => [p.lat, p.lng])} />
                {points.map((p, i) => (
                  <Marker
                    key={`${p.type}-${i}`}
                    position={[p.lat, p.lng]}
                    icon={p.type === "client" ? CLIENT_ICON : EMPLOYEE_ICON}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{p.label}</strong>
                        <div className="text-xs text-muted-foreground mt-1">
                          {p.type === "client" ? "Client" : "Intervenant"}
                        </div>
                        {p.details && <div className="text-xs mt-1">{p.details}</div>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Aucune adresse géocodée à afficher.
                <br />
                Ajoute des adresses avec latitude/longitude aux clients et intervenants.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Légende</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-blue-500" /> Client
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-purple-500" /> Intervenant
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-green-500" /> Intervention du jour
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interventions du jour</CardTitle>
              <CardDescription>{today}</CardDescription>
            </CardHeader>
            <CardContent>
              {interventionEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune intervention aujourd'hui.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {interventionEvents.slice(0, 10).map((iv: any) => (
                    <li key={iv.id} className="flex items-start gap-2 border-b pb-1.5 last:border-0">
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {new Date(iv.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{iv.client?.code ?? "?"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {iv.employee?.name ?? "À pourvoir"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
