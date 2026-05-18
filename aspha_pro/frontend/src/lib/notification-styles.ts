import {
  Calendar, CalendarX, RotateCw, Users as UsersIcon,
  Briefcase, GraduationCap, PackageOpen, AlertCircle,
  MessageSquare, FileSignature, Clock, AlarmClockOff, Wallet,
  Receipt, Sparkles, Bell,
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
  signature_requested: {
    icon: FileSignature,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-100 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-l-fuchsia-500",
    module: "Signature",
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
 * Lien profond optionnel selon le target_type.
 * Permet de cliquer sur une notif → ouvrir la fiche correspondante.
 *
 * Le backend stocke `target_type` via Eloquent `getMorphClass()` :
 *  - "client_request" si le model est dans la morphMap (recommandé)
 *  - "App\\Models\\ClientRequest" en fallback (legacy)
 * On gère les deux pour être tolérant aux notifs déjà en BDD.
 */
export function getNotificationLink(
  targetType: string | null,
  targetId: number | null,
): string | null {
  if (!targetType || !targetId) return null;

  // Normalise FQN → short code : "App\\Models\\ClientRequest" → "client_request"
  const short = targetType.includes("\\")
    ? targetType.split("\\").pop()!.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()
    : targetType;

  switch (short) {
    case "intervention": return `/planning?focus=${targetId}`;
    case "client_request": return `/tickets/${targetId}`;
    case "message_thread": return `/messagerie?thread=${targetId}`;
    case "client": return `/clients/${targetId}`;
    case "employee": return `/intervenants/${targetId}`;
    case "invoice": return `/factures?focus=${targetId}`;
    case "quote": return `/devis?focus=${targetId}`;
    default: return null;
  }
}
