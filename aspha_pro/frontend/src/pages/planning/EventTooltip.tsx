import { Calendar, Clock, MapPin, Mail, Phone, User, Briefcase, Euro, Repeat, FileCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarEvent } from "@/hooks/use-phase3";

const STATUS_LABELS: Record<string, string> = {
  a_pourvoir: "À pourvoir",
  planifiee: "Planifiée",
  realisee: "Terminée",
  annulee: "Annulée",
  draft: "Brouillon",
  terminated: "Terminée",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planifiee: "default",
  realisee: "secondary",
  annulee: "destructive",
  a_pourvoir: "outline",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Quotidienne", weekly: "Hebdomadaire", monthly: "Mensuelle", yearly: "Annuelle",
};

const DAY_FULL: Record<string, string> = {
  mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
};

/**
 * Carte de hover affichant TOUTES les informations utiles sur un RDV :
 * client + contact + adresse, intervenant, prestation + tarif, horaires,
 * périodicité, statut + flags facturation/paiement modifiables en place.
 *
 * Rendue en position fixed (px) — positionnée par PlanningPage selon le
 * bounding rect de l'event au hover.
 */
export function EventTooltip({
  ev,
  x,
  y,
  onToggle,
  hidePricing,
}: {
  ev: CalendarEvent & { [k: string]: any };
  x: number;
  y: number;
  onToggle: (field: "bill_client" | "is_paid", value: boolean) => void;
  /**
   * F1 — masque toute info de prix/total + les cases « Facturer / Payer ».
   * Utilisé par l'extranet INTERVENANT (qui ne doit jamais voir les tarifs).
   * Par défaut on déduit la valeur de l'absence de données de prix dans le
   * payload (l'endpoint intervenant les retire côté backend).
   */
  hidePricing?: boolean;
}) {
  const start = new Date(ev.start_datetime);
  const end = new Date(ev.end_datetime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const durationH = (durationMin / 60).toFixed(2).replace(/\.?0+$/, "");
  const unitPrice = ev.prestation?.unit_price ?? 0;
  const totalPrice = ev.prestation?.pricing_type === "hourly"
    ? unitPrice * (durationMin / 60)
    : unitPrice;

  // Masquage des prix : explicite via prop OU déduit de l'absence de
  // unit_price / pricing_type dans le payload (cas extranet intervenant).
  const pricingHidden = hidePricing
    || (ev.prestation?.unit_price == null && ev.prestation?.pricing_type == null);

  const days = (ev.days_of_week ?? "").split(",").map((d) => DAY_FULL[d.trim()] ?? d.trim()).filter(Boolean);

  // Clamp x à la fenêtre pour ne pas sortir
  const safeX = Math.min(x, window.innerWidth - 380);
  const safeY = Math.min(y, window.innerHeight - 420);

  // stopPropagation pour que cliquer sur la checkbox n'ouvre pas le détail
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="pointer-events-auto fixed z-50 w-[360px] rounded-xl border bg-popover/95 backdrop-blur-md shadow-2xl text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ left: safeX, top: safeY }}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Bande de couleur en haut */}
      <div className="h-1 bg-gradient-aspha" />
      {/* Header : client + statut */}
      <div className="border-b px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">
              {ev.client?.company_name ?? ev.client?.code ?? "Client inconnu"}
            </div>
            {(ev.client?.first_name || ev.client?.last_name) && (
              <div className="text-xs text-muted-foreground truncate">
                {ev.client.first_name} {ev.client.last_name}
              </div>
            )}
          </div>
          <Badge variant={STATUS_VARIANT[ev.status ?? ""] ?? "outline"} className="shrink-0">
            {STATUS_LABELS[ev.status ?? ""] ?? ev.status}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Date / horaires */}
        <Row icon={<Calendar className="h-3 w-3" />}>
          {start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </Row>
        <Row icon={<Clock className="h-3 w-3" />}>
          {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          {" → "}
          {end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          <span className="text-muted-foreground"> · {durationH}h</span>
        </Row>

        {/* Adresse — toujours affichée (placeholder si manquante) */}
        <Row icon={<MapPin className="h-3 w-3" />}>
          {ev.client?.address?.address ? (
            <span className="text-xs">
              {ev.client.address.address}
              {ev.client.address.city && (
                <>, {ev.client.address.postal_code ?? ""} {ev.client.address.city}</>
              )}
            </span>
          ) : (
            <span className="text-xs italic text-muted-foreground">Adresse non renseignée</span>
          )}
        </Row>

        {/* Téléphone / Email — affichés en placeholder si manquants */}
        <Row icon={<Phone className="h-3 w-3" />}>
          {ev.client?.phone ? (
            <span className="font-mono text-xs">{ev.client.phone}</span>
          ) : (
            <span className="text-xs italic text-muted-foreground">Téléphone non renseigné</span>
          )}
        </Row>
        {ev.client?.email && (
          <Row icon={<Mail className="h-3 w-3" />}><span className="text-xs">{ev.client.email}</span></Row>
        )}

        <div className="border-t my-2" />

        {/* Intervenant */}
        <Row icon={<User className="h-3 w-3" />}>
          {ev.employee?.name ? (
            <span className="font-medium">{ev.employee.name}</span>
          ) : (
            <span className="italic text-muted-foreground">Aucun intervenant assigné</span>
          )}
        </Row>

        {/* Prestation (libellé toujours affiché) + prix (masqué si pricingHidden) */}
        {ev.prestation && (
          <>
            <Row icon={<Briefcase className="h-3 w-3" />}>
              {ev.prestation.label ?? ev.prestation.product_name ?? "—"}
            </Row>
            {!pricingHidden && unitPrice > 0 && (
              <Row icon={<Euro className="h-3 w-3" />}>
                {ev.prestation.pricing_type === "hourly" ? (
                  <span>
                    {unitPrice.toFixed(2)} €/h
                    <span className="text-muted-foreground"> · total {totalPrice.toFixed(2)} €</span>
                  </span>
                ) : (
                  <span>{unitPrice.toFixed(2)} € (forfait)</span>
                )}
              </Row>
            )}
          </>
        )}

        {/* Périodicité */}
        <Row icon={<Repeat className="h-3 w-3" />}>
          {ev.is_recurring ? (
            <span>
              <span className="font-medium">{FREQUENCY_LABELS[ev.frequency ?? ""] ?? ev.frequency}</span>
              {days.length > 0 && (
                <span className="text-muted-foreground"> · {days.join(", ")}</span>
              )}
              {ev.start_time && ev.end_time && (
                <span className="text-muted-foreground"> · {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Ponctuelle</span>
          )}
        </Row>

        {/* Flags facturation / paiement — masqués pour l'intervenant (F1) */}
        {!pricingHidden && (
          <>
            <div className="border-t my-2" />
            <div className="space-y-1.5" onClick={stop}>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox
                  checked={ev.bill_client ?? true}
                  onCheckedChange={(v) => onToggle("bill_client", v === true)}
                />
                <FileCheck className="h-3 w-3 text-muted-foreground" />
                <span className={ev.bill_client === false ? "line-through text-muted-foreground" : ""}>
                  Facturer au client
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox
                  checked={ev.is_paid ?? true}
                  onCheckedChange={(v) => onToggle("is_paid", v === true)}
                />
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span className={ev.is_paid === false ? "line-through text-muted-foreground" : ""}>
                  Payer l'intervenant
                </span>
              </label>
              {ev.is_billed && (
                <div className="text-[10px] text-green-700 dark:text-green-400">
                  ✓ Déjà facturée
                </div>
              )}
            </div>
          </>
        )}

        {/* Commentaire public (visible par tous) */}
        {ev.comment && (
          <>
            <div className="border-t my-2" />
            <p className="text-xs italic text-muted-foreground line-clamp-3">{ev.comment}</p>
          </>
        )}

        {/* Note interne du RDV (F2) — affichée surtout pour l'intervenant */}
        {ev.internal_comment && (
          <>
            <div className="border-t my-2" />
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Note interne (RDV)
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-line">
                {ev.internal_comment}
              </p>
            </div>
          </>
        )}

        {/* Consignes client transmises aux intervenants (B6/F2) */}
        {ev.client?.intervenant_notes && (
          <>
            <div className="border-t my-2" />
            <div className="rounded-md bg-sky-50 dark:bg-sky-950/40 px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                Consignes client
              </div>
              <p className="text-xs text-sky-900 dark:text-sky-200 whitespace-pre-line">
                {ev.client.intervenant_notes}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
        Clique sur l'événement pour plus d'actions
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
