import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Building2, User as UserIcon } from "lucide-react";

/**
 * Avatar/Logo affiché pour un intervenant ou un client.
 * - Si `src` (URL absolue) est dispo → image (object-cover).
 * - Sinon → initiales sur fond coloré déterministe.
 * - Si pas de nom → icône générique (Building pour client, User pour employee).
 *
 * On utilise une fonction de hash simple pour le fond coloré : 2 noms identiques
 * = même couleur, ce qui aide à scanner visuellement un tableau de noms.
 */
type Props = {
  src?: string | null;
  name?: string | null;
  variant?: "employee" | "client";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_PX: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg",
};

// Palette pastel — fonds doux qui restent lisibles avec du texte foncé.
const BG_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function EntityAvatar({ src, name, variant = "employee", size = "sm", className }: Props) {
  const cleanName = (name ?? "").trim();
  const fallbackColor = cleanName ? pickColor(cleanName) : "bg-muted text-muted-foreground";
  const FallbackIcon = variant === "client" ? Building2 : UserIcon;

  return (
    <Avatar className={cn(SIZE_PX[size], "shrink-0 rounded-full", className)}>
      {src && <AvatarImage src={src} alt={cleanName} />}
      <AvatarFallback className={cn("rounded-full font-semibold", fallbackColor)}>
        {cleanName ? initials(cleanName) : <FallbackIcon className="h-1/2 w-1/2 opacity-60" />}
      </AvatarFallback>
    </Avatar>
  );
}
