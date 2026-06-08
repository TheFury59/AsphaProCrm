// Helper toast — wrap react-native-toast-message.
// Le <Toast /> root est monte dans app/_layout.tsx.

import Toast, { BaseToast, ErrorToast, type BaseToastProps } from "react-native-toast-message";

import { colors, spacing } from "@/lib/theme";

export type ToastVariant = "success" | "error" | "info";

export function showToast(message: string, variant: ToastVariant = "info", title?: string): void {
  Toast.show({
    type: variant,
    text1: title ?? defaultTitle(variant),
    text2: message,
    position: "top",
    visibilityTime: variant === "error" ? 4500 : 3000,
    topOffset: 60,
  });
}

function defaultTitle(variant: ToastVariant): string {
  switch (variant) {
    case "success":
      return "Succes";
    case "error":
      return "Erreur";
    case "info":
      return "Info";
  }
}

// Config visuelle Aspha — a passer en prop `config` au <Toast /> root.
export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.success, borderLeftWidth: 5, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      text1Style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
      text2Style={{ fontSize: 13, color: colors.textMuted }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: colors.danger, borderLeftWidth: 5, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      text1Style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
      text2Style={{ fontSize: 13, color: colors.textMuted }}
    />
  ),
  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.info, borderLeftWidth: 5, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      text1Style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
      text2Style={{ fontSize: 13, color: colors.textMuted }}
    />
  ),
};
