import { useContractStatus } from "@/hooks/use-planning";
import type { Employee } from "@/types/api";

type Props = {
  employee: Employee | null;
  from: string;
  to: string;
};

export function ContractStatusPanel({ employee, from, to }: Props) {
  const { data, isLoading } = useContractStatus(employee?.id ?? null, from, to);

  if (!employee) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Sélectionne un intervenant pour voir le suivi des heures contractuelles.
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="rounded-md border p-3 text-sm text-muted-foreground">Calcul…</div>;
  }

  const fillRateColor =
    data.fill_rate >= 95 ? "bg-red-500" :
    data.fill_rate >= 80 ? "bg-orange-400" :
    data.fill_rate >= 50 ? "bg-blue-500" :
    "bg-slate-300";

  return (
    <div className="rounded-md border p-3 space-y-3 text-sm">
      <div>
        <div className="font-semibold">{employee.full_name}</div>
        <div className="text-xs text-muted-foreground">
          {employee.current_contract?.position ?? "—"} · {data.weekly_hours} h/semaine
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Taux de remplissage</span>
          <span className="font-medium">{data.fill_rate}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${fillRateColor}`}
            style={{ width: `${Math.min(100, data.fill_rate)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border p-2">
          <div className="text-muted-foreground">Heures contrat</div>
          <div className="font-semibold text-base">{data.contract_hours} h</div>
        </div>
        <div className="rounded border p-2">
          <div className="text-muted-foreground">Heures placées</div>
          <div className="font-semibold text-base">{data.hours_planned} h</div>
        </div>
        <div className="rounded border p-2 col-span-2">
          <div className="text-muted-foreground">Heures restantes</div>
          <div className={`font-semibold text-base ${data.hours_remaining < 0 ? "text-red-600" : ""}`}>
            {data.hours_remaining} h
          </div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">
        Fenêtre : {data.window.weeks} sem. ({data.window.from} → {data.window.to})
      </div>
    </div>
  );
}
