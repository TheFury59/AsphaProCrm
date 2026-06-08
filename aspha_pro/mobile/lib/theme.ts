// Design tokens Aspha Pro — couleurs, espacement, typo.
// On reste sur des constantes simples plutot qu'un theme provider pour l'instant :
// l'app est en light only au sprint P0-1.

export const colors = {
  // Brand
  primary: "#10b981", // vert Aspha
  primaryDark: "#059669",
  primaryLight: "#34d399",
  accent: "#0ea5e9", // bleu Aspha
  accentDark: "#0284c7",

  // Neutrals
  background: "#ffffff",
  surface: "#f8fafc",
  surfaceMuted: "#f1f5f9",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  // Text
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  textInverse: "#ffffff",

  // Semantic
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
  info: "#0ea5e9",

  // Overlay
  overlay: "rgba(15, 23, 42, 0.5)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

// Gradient utilise pour le header de login (visuel marque Aspha).
export const brandGradient = [colors.primary, colors.accent] as const;
