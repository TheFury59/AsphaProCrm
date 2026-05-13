import { Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContractSummary } from "@/hooks/use-planning-summary";

/**
 * Panneau latéral du planning : par intervenant, indique heures contrat /
 * heures planifiées / heures dispo + % de remplissage sur la fenêtre courante.
 *
 * Calcul sur backend (PlanningSummaryController.contractSummary) :
 *  - contract_window_hours = weekly_duration × nb_semaines_fenêtre
 *  - planned_hours = somme durée events sur la fenêtre
 *  - available = max(0, window - planned)
 *  - fill_rate = planned / window
 */
export function ContractSummaryPanel({ from, to, employeeFilter }: {
  from: string;
  to: string;
  employeeFilter: number | null;
}) {
  const { data, isLoading } = useContractSummary({
    from, to,
    employee_id: employeeFilter ?? undefined,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-3 border-b">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" />
          Remplissage contrats
        </CardTitle>
      </CardHeader>
      <ScrollArea className="h-[400px]">
        <CardContent className="p-2 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-2">Calcul…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Aucun intervenant.</p>
          ) : (
            data?.map((s) => (
              <div key={s.employee_id} className="rounded-md border p-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium truncate">{s.employee_name}</span>
                  {s.over_quota && (
                    <Badge variant="destructive" className="text-[9px] h-4 px-1">Quota dépassé</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  <span>
                    <strong className="text-foreground">{s.planned_hours}h</strong>
                    {" / "}
                    {s.contract_window_hours}h
                  </span>
                  <span className="ml-auto">
                    {s.available_hours}h dispo
                  </span>
                </div>
                <Progress
                  value={Math.min(100, s.fill_rate_pct)}
                  className={s.over_quota ? "[&>div]:bg-destructive" : s.fill_rate_pct > 85 ? "[&>div]:bg-orange-500" : ""}
                />
                <div className="text-[10px] text-right text-muted-foreground">
                  {s.fill_rate_pct}%
                </div>
              </div>
            ))
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
