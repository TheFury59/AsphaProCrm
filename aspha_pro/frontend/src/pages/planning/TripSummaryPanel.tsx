import { Car, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTrips } from "@/hooks/use-planning-summary";

/**
 * Récap trajets entre RDV consécutifs — affiche par intervenant le total
 * payé / non payé (km + min).
 *
 * Règle : ≤ paid_threshold_minutes (45 min défaut) entre fin RDV N et début RDV N+1
 * → trajet payé. Sinon non payé (pause prolongée).
 */
export function TripSummaryPanel({ from, to, employeeFilter }: {
  from: string;
  to: string;
  employeeFilter: number | null;
}) {
  const { data, isLoading } = useTrips({
    from, to,
    employee_id: employeeFilter ?? undefined,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-3 border-b">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Car className="h-3 w-3" />
          Trajets ({data?.paid_threshold_minutes ?? 45} min payé max)
        </CardTitle>
      </CardHeader>
      <ScrollArea className="h-[280px]">
        <CardContent className="p-2 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-2">Calcul…</p>
          ) : (data?.summary?.length ?? 0) === 0 ? (
            <div className="p-2 space-y-1.5 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Aucun trajet calculé</p>
              <p>Le calcul nécessite :</p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li>2+ RDV consécutifs le même jour</li>
                <li>Un intervenant assigné (pas "À pourvoir")</li>
                <li>Adresses clients géocodées (lat/lng)</li>
              </ul>
              {data?.diagnostics && (
                <div className="mt-2 pt-2 border-t space-y-0.5">
                  <div className="flex justify-between">
                    <span>Total RDV :</span>
                    <span className="font-medium text-foreground">{data.diagnostics.total_events}</span>
                  </div>
                  {data.diagnostics.unassigned_events > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Sans intervenant :</span>
                      <span className="font-medium">{data.diagnostics.unassigned_events}</span>
                    </div>
                  )}
                  {data.diagnostics.events_without_geocoded_address > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Sans adresse géocodée :</span>
                      <span className="font-medium">{data.diagnostics.events_without_geocoded_address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            data?.summary.map((s) => (
              <div key={s.employee_id} className="rounded-md border p-2 space-y-1.5 text-xs">
                <div className="font-medium truncate">{s.employee_name}</div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="space-y-0.5">
                    <Badge variant="default" className="text-[9px] h-4 px-1.5">Payé</Badge>
                    <div>{s.paid_trips} trajet{s.paid_trips > 1 ? "s" : ""}</div>
                    <div className="text-muted-foreground">
                      {s.paid_distance_km} km · {formatMin(s.paid_duration_minutes)}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">Non payé</Badge>
                    <div>{s.unpaid_trips} trajet{s.unpaid_trips > 1 ? "s" : ""}</div>
                    <div className="text-muted-foreground">
                      {s.unpaid_distance_km} km · {formatMin(s.unpaid_duration_minutes)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {data && data.trips.some((t) => t.source === "haversine") && (
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-t flex items-start gap-1">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Sans clé Google Maps configurée, fallback Haversine (précision ±20%).</span>
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

function formatMin(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}
