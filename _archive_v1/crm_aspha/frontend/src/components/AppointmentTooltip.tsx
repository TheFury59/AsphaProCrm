import type { Appointment } from "@/types/api";
import { Clock, MapPin, Phone, Repeat, User, Euro } from "lucide-react";

const STATUS_LABELS: Record<Appointment["status"], string> = {
  planned: "Planifié",
  done: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const STATUS_CLASSES: Record<Appointment["status"], string> = {
  planned: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-orange-100 text-orange-800",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function AppointmentTooltip({ appointment: a }: { appointment: Appointment }) {
  return (
    <div className="w-80 rounded-md border bg-popover p-3 shadow-lg text-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-popover-foreground">
          {a.service?.name ?? "Prestation"}
        </div>
        <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${STATUS_CLASSES[a.status]}`}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        {formatDate(a.scheduled_start)} — {formatTime(a.scheduled_start)} → {formatTime(a.scheduled_end)}
      </div>

      <ul className="space-y-1.5 text-xs">
        <li className="flex items-start gap-2">
          <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-medium">{a.client?.display_name ?? "—"}</div>
            {a.client?.phone && (
              <div className="text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {a.client.phone}
              </div>
            )}
          </div>
        </li>
        {a.address && (
          <li className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="text-muted-foreground">
              {a.address.line1}<br />
              {a.address.postal_code} {a.address.city}
            </div>
          </li>
        )}
        <li className="flex items-start gap-2">
          <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div>Intervenant : <span className="font-medium">{a.employee?.full_name ?? "Non assigné"}</span></div>
        </li>
        {a.recurrence && (
          <li className="flex items-start gap-2">
            <Repeat className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="text-muted-foreground">
              {a.recurrence.type === "recurring" ? `Récurrent — ${a.recurrence.rule}` : "Ponctuel"}
            </div>
          </li>
        )}
        {a.service?.hourly_rate != null && (
          <li className="flex items-start gap-2">
            <Euro className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="text-muted-foreground">{a.service.hourly_rate.toFixed(2)} € / h</div>
          </li>
        )}
        <li className="flex items-start gap-2">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="space-x-3">
            <span className={a.paid_to_employee ? "text-green-700" : "text-muted-foreground line-through"}>
              Payé intervenant
            </span>
            <span className={a.invoiced_to_client ? "text-green-700" : "text-muted-foreground line-through"}>
              Facturé client
            </span>
          </div>
        </li>
      </ul>
    </div>
  );
}
