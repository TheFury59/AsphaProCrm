import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterventions, type CalendarEvent } from "@/hooks/use-phase3";

const STATUS_COLORS: Record<string, string> = {
  planifiee: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  realisee: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  annulee: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  a_pourvoir: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
const STATUS_LABELS: Record<string, string> = {
  planifiee: "Planifiée", realisee: "Terminée", annulee: "Annulée", a_pourvoir: "À pourvoir",
};

/**
 * Onglet planning de la fiche intervenant — liste les interventions à venir
 * et passées sur les 30 derniers jours / 90 prochains jours.
 */
export function EmployeePlanningTab({ employeeId }: { employeeId: number }) {
  const [showPast, setShowPast] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const past30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const future90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const { data, isLoading } = useInterventions({
    from: showPast ? past30 : today,
    to: future90,
    employee_id: employeeId,
  });

  const sorted = (data ?? []).sort((a: CalendarEvent, b: CalendarEvent) =>
    a.start_datetime.localeCompare(b.start_datetime),
  );

  // Groupe par mois pour la lisibilité
  const grouped = sorted.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const monthKey = format(new Date(ev.start_datetime), "MMMM yyyy", { locale: fr });
    (acc[monthKey] ??= []).push(ev);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Interventions ({sorted.length})
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPast((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              showPast
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted-foreground/20"
            }`}
          >
            {showPast ? "Inclure 30 derniers jours" : "À partir d'aujourd'hui"}
          </button>
          <Link to="/planning">
            <Button variant="ghost" size="sm" className="text-xs">
              Planning complet <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Aucune intervention prévue {showPast ? "sur cette période" : "à venir"}.
          </p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([month, events]) => (
              <div key={month}>
                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 capitalize">
                  {month}
                </h4>
                <ul className="space-y-1.5">
                  {events.map((ev: any) => (
                    <li key={ev.id} className="flex items-center gap-3 rounded-lg border bg-card hover:bg-muted/40 p-3 transition-colors">
                      <div className="text-center shrink-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {format(new Date(ev.start_datetime), "EEE", { locale: fr })}
                        </div>
                        <div className="text-xl font-semibold leading-none">
                          {format(new Date(ev.start_datetime), "d", { locale: fr })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {ev.client?.company_name ?? ev.client?.code ?? "Client inconnu"}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>
                            {format(new Date(ev.start_datetime), "HH:mm", { locale: fr })}
                            {" – "}
                            {format(new Date(ev.end_datetime), "HH:mm", { locale: fr })}
                          </span>
                          {ev.client?.address?.city && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {ev.client.address.city}
                            </span>
                          )}
                          {ev.is_recurring && <Badge variant="secondary" className="text-[9px] h-4 px-1">🔁</Badge>}
                        </div>
                      </div>
                      <Badge className={`text-[10px] ${STATUS_COLORS[ev.status ?? ""] ?? ""}`}>
                        {STATUS_LABELS[ev.status ?? ""] ?? ev.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
