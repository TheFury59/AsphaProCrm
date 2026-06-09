// Helpers de dates pour le mobile.
//
// Convention backend : Carbon serialise les datetimes intervention en chaine LOCALE
// naive « YYYY-MM-DDTHH:mm:ss » (pas de Z, pas d'offset) — l'app est mono-fuseau
// (Europe/Paris) cote ERP. On parse en local naif via `new Date(value)` qui en
// presence d'un format ISO sans offset interprete en local timezone.
//
// IMPORTANT : on n'utilise JAMAIS `Date.toISOString().slice(0, 10)` pour extraire
// une date locale (cf. lessons.md 2026-05-18 : decalage UTC -> off-by-one a
// 23h Paris). On construit a la main avec getFullYear/getMonth/getDate.

const WEEKDAYS_LONG = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

const MONTHS_LONG = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
] as const;

// Parse une chaine ISO locale naive « YYYY-MM-DDTHH:mm:ss » en Date locale.
// Si la chaine contient un Z ou un offset, la Date sera quand meme valide
// (interpretation standard). Retourne null si invalide.
export function parseLocalNaive(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Formate un Date en clé jour `YYYY-MM-DD` en heure LOCALE (jamais UTC).
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Format `HH:mm` en heure locale.
export function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// « Lundi 8 juin » — sans annee, pour les headers de section.
export function formatDateShort(d: Date): string {
  const wd = WEEKDAYS_LONG[d.getDay()] ?? "";
  const day = d.getDate();
  const month = MONTHS_LONG[d.getMonth()] ?? "";
  return `${wd} ${day} ${month}`;
}

// « Lundi 8 juin 2026 » — pour le header detail RDV.
export function formatDateLong(d: Date): string {
  return `${formatDateShort(d)} ${d.getFullYear()}`;
}

// « du 8 au 14 juin 2026 » (gere les transitions de mois/annee).
export function formatRange(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  const fromDay = from.getDate();
  const toDay = to.getDate();
  const fromMonth = MONTHS_LONG[from.getMonth()] ?? "";
  const toMonth = MONTHS_LONG[to.getMonth()] ?? "";

  if (sameMonth) {
    return `du ${fromDay} au ${toDay} ${toMonth} ${to.getFullYear()}`;
  }
  if (sameYear) {
    return `du ${fromDay} ${fromMonth} au ${toDay} ${toMonth} ${to.getFullYear()}`;
  }
  return `du ${fromDay} ${fromMonth} ${from.getFullYear()} au ${toDay} ${toMonth} ${to.getFullYear()}`;
}

// Ajoute n jours a une Date (retourne une nouvelle Date, ne mute pas l'entree).
export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

// Aujourd'hui a 00:00 local (utile pour les bornes de query).
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Debut de la journee de `d` (00:00:00.000).
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Fin de la journee de `d` (23:59:59.999).
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Debut de la semaine (lundi 00:00) — convention francaise.
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const weekday = x.getDay(); // 0 dim, 1 lun, ... 6 sam
  const offset = weekday === 0 ? -6 : 1 - weekday; // ramene au lundi
  x.setDate(x.getDate() + offset);
  return x;
}

// Fin de semaine (dimanche 23:59).
export function endOfWeek(d: Date): Date {
  return endOfDay(addDays(startOfWeek(d), 6));
}

// Debut du mois (1er a 00:00).
export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

// Fin du mois (dernier jour a 23:59).
export function endOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0); // veille du 1er du mois suivant = dernier du mois courant
  x.setHours(23, 59, 59, 999);
  return x;
}

// « Juin 2026 » — pour le header en mode mois.
export function formatMonthYear(d: Date): string {
  const month = MONTHS_LONG[d.getMonth()] ?? "";
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
}
