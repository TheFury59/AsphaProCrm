import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, UserX } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLongAbsences } from "@/hooks/use-planning-summary";

/**
 * Bandeau sticky en haut du planning listant les absences ≥ seuil (paramétrable
 * via /settings/public.long_absence_threshold_days, défaut 5 jours).
 * Collapsible : visible mais on peut le réduire.
 */
export function LongAbsenceBanner({ from, to }: { from: string; to: string }) {
  const { data } = useLongAbsences({ from, to });
  const [collapsed, setCollapsed] = useState(false);

  if (!data || data.data.length === 0) return null;

  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 mb-3 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
        <span className="font-medium text-sm text-orange-900 dark:text-orange-100">
          {data.data.length} absence{data.data.length > 1 ? "s" : ""} longue{data.data.length > 1 ? "s" : ""} durée (≥ {data.threshold_days} j)
        </span>
        {collapsed ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronUp className="h-3 w-3 ml-auto" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {data.data.map((a) => (
            <Badge key={`${a.kind}-${a.id}`} variant="outline" className="border-orange-400 gap-1.5 py-1 px-2">
              <UserX className="h-3 w-3" />
              <span className="font-medium">{a.person_name}</span>
              <span className="text-muted-foreground">
                {format(new Date(a.start_date), "dd/MM", { locale: fr })}
                {" → "}
                {a.end_date ? format(new Date(a.end_date), "dd/MM", { locale: fr }) : "indéfini"}
              </span>
              {a.reason_label && (
                <span className="text-[10px] text-muted-foreground">· {a.reason_label}</span>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
