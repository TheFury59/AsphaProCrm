import {
  Calendar, CalendarX, RotateCw, Users as UsersIcon,
  Briefcase, GraduationCap, PackageOpen, AlertCircle,
  MessageSquare, Clock, AlarmClockOff, Wallet,
  Receipt, Sparkles, Bell, FileText, CheckCircle2, FileSignature,
} from "lucide-react";

/**
 * Mapping notification_type.code → style visuel.
 * - icon : icône Lucide
 * - color : couleur du picto (texte + bordure gauche de l'item)
 * - bg : badge léger pour le module dans la barre des notifs
 * - module : libellé court pour grouper
 *
 * Codes définis dans backend/database/seeders/NotificationTypesSeeder.php.
 * Si un code inconnu apparaît, fallback = Bell gris.
 */
export type NotificationStyle = {
  icon: typeof Bell;
  color: string;
  bg: string;
  border: string;
  module: string;
};

const STYLES: Record<string, NotificationStyle> = {
  // === Planning (réservations / interventions) ===
  intervention_assigned: {
    icon: Calendar,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
    border: "border-l-emerald-500",
    module: "Réservation",
  },
  intervention_modified: {
    icon: RotateCw,
    color: "text-sky-600",
    bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300",
    border: "border-l-sky-500",
    module: "Modif planning",
  },
  intervention_cancelled: {
    icon: CalendarX,
    color: "text-rose-600",
    bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
    border: "border-l-rose-500",
    module: "Annulation",
  },
  replacement_requested: {
    icon: UsersIcon,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
    border: "border-l-amber-500",
    module: "Remplacement",
  },

  // === RH ===
  absence_created: {
    icon: Briefcase,
    color: "text-violet-600",
    bg: "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300",
    border: "border-l-violet-500",
    module: "RH",
  },
  training_due: {
    icon: GraduationCap,
    color: "text-violet-600",
    bg: "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300",
    border: "border-l-violet-500",
    module: "RH",
  },

  // === Stock ===
  stock_alert: {
    icon: PackageOpen,
    color: "text-orange-600",
    bg: "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300",
    border: "border-l-orange-500",
    module: "Stock",
  },

  // === Tickets / portail ===
  client_request_new: {
    icon: AlertCircle,
    color: "text-rose-600",
    bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
    border: "border-l-rose-500",
    module: "Ticket",
  },
  client_reorder_new: {
    icon: PackageOpen,
    color: "text-sky-600",
    bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300",
    border: "border-l-sky-500",
    module: "Réassort",
  },

  // === Télégestion ===
  checkin_late: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
    border: "border-l-amber-500",
    module: "Badgeage",
  },
  checkin_missed: {
    icon: AlarmClockOff,
    color: "text-rose-600",
    bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
    border: "border-l-rose-500",
    module: "Badgeage",
  },
  // Récap des heures travaillées (hebdo / mensuel)
  worked_hours_summary: {
    icon: Clock,
    color: "text-teal-600",
    bg: "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300",
    border: "border-l-teal-500",
    module: "Heures",
  },

  // === Ventes ===
  invoice_paid: {
    icon: Wallet,
    color: "text-emerald-600",
    bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
    border: "border-l-emerald-500",
    module: "Paiement",
  },
  invoice_overdue: {
    icon: Receipt,
    color: "text-rose-600",
    bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
    border: "border-l-rose-500",
    module: "Impayé",
  },
  invoice_issued: {
    icon: Receipt,
    color: "text-indigo-600",
    bg: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
    border: "border-l-indigo-500",
    module: "Facture",
  },
  // Devis envoyé → invitation à valider (côté client)
  quote_sent: {
    icon: FileText,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
    border: "border-l-amber-500",
    module: "Devis",
  },
  // Devis validé par le client (côté admin)
  quote_accepted: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
    border: "border-l-emerald-500",
    module: "Devis validé",
  },

  // === Missions ===
  mission_created: {
    icon: FileSignature,
    color: "text-violet-600",
    bg: "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300",
    border: "border-l-violet-500",
    module: "Mission",
  },

  // === Tickets — mise à jour de statut ===
  client_request_status: {
    icon: AlertCircle,
    color: "text-sky-600",
    bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300",
    border: "border-l-sky-500",
    module: "Ticket",
  },
  // Nouveau message dans le fil de discussion d'un ticket
  client_request_message: {
    icon: MessageSquare,
    color: "text-sky-600",
    bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300",
    border: "border-l-sky-500",
    module: "Ticket",
  },
  // Intervenant affecté à un ticket
  client_request_assigned: {
    icon: UsersIcon,
    color: "text-sky-600",
    bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300",
    border: "border-l-sky-500",
    module: "Ticket",
  },
  // RDV à pourvoir (intervention sans intervenant)
  intervention_unassigned: {
    icon: UsersIcon,
    color: "text-orange-600",
    bg: "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300",
    border: "border-l-orange-500",
    module: "À pourvoir",
  },

  // === Messagerie ===
  new_message: {
    icon: MessageSquare,
    color: "text-primary",
    bg: "bg-primary/10 text-primary",
    border: "border-l-primary",
    module: "Message",
  },

  // === Matching ===
  matching_proposal: {
    icon: Sparkles,
    color: "text-cyan-600",
    bg: "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300",
    border: "border-l-cyan-500",
    module: "Matching",
  },
};

const FALLBACK: NotificationStyle = {
  icon: Bell,
  color: "text-muted-foreground",
  bg: "bg-muted text-muted-foreground",
  border: "border-l-muted-foreground/40",
  module: "Notif",
};

export function getNotificationStyle(code?: string | null): NotificationStyle {
  if (!code) return FALLBACK;
  return STYLES[code] ?? FALLBACK;
}

/**
 * Classes de mise en évidence selon la priorité de la notification.
 * Renvoie une chaîne vide pour 'normal' (rendu standard inchangé).
 * - high     → fond ambré marqué + bordure gauche épaisse ambrée
 * - critical → fond rouge marqué + bordure gauche épaisse rouge
 */
export function getPriorityClasses(
  priority?: string | null,
): string {
  switch (priority) {
    case "critical":
      return "bg-rose-50 dark:bg-rose-950/40 !border-l-rose-600 border-l-[6px]";
    case "high":
      return "bg-amber-50 dark:bg-amber-950/40 !border-l-amber-500 border-l-[6px]";
    default:
      return "";
  }
}

/**
 * Lien profond optionnel selon le target_type.
 * Permet de cliquer sur une notif → ouvrir la fiche correspondante.
 *
 * Le backend stocke `target_type` via Eloquent `getMorphClass()` :
 *  - "client_request" si le model est dans la morphMap (recommandé)
 *  - "App\\Models\\ClientRequest" en fallback (legacy)
 * On gère les deux pour être tolérant aux notifs déjà en BDD.
 *
 * `isExtranet` : la cloche est partagée entre le CRM admin et les extranets
 * client/intervenant. Un client ne peut PAS naviguer vers une route admin
 * (`/devis`, `/factures`…). En contexte extranet, les deep-links pointent
 * donc vers les pages de l'espace client.
 */
export function getNotificationLink(
  targetType: string | null,
  targetId: number | null,
  isExtranet = false,
): string | null {
  if (!targetType || !targetId) return null;

  // Normalise FQN → short code : "App\\Models\\ClientRequest" → "client_request"
  const short = targetType.includes("\\")
    ? targetType.split("\\").pop()!.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()
    : targetType;

  if (isExtranet) {
    // Espace client : on dirige vers les pages de l'extranet. La page liste
    // suffit (le client y consulte/valide via le dialog) — pas de focus par id.
    switch (short) {
      case "quote": return "/extranet/client/devis";
      case "invoice": return "/extranet/client/factures";
      default: return null;
    }
  }

  switch (short) {
    case "intervention": return `/planning?focus=${targetId}`;
    case "client_request": return `/tickets/${targetId}`;
    case "message_thread": return `/messagerie?thread=${targetId}`;
    case "client": return `/clients/${targetId}`;
    case "employee": return `/intervenants/${targetId}`;
    case "invoice": return `/factures?focus=${targetId}`;
    case "quote": return `/devis?focus=${targetId}`;
    case "mission": return `/missions`;
    default: return null;
  }
}
