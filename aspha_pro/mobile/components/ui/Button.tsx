import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { colors, radius, spacing, typography } from "@/lib/theme";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  testID,
}: Props) {
  // NOTE: pas de disabled visuel pour regle metier. On ignore juste les taps
  // pendant le loading reseau pour eviter le double submit.
  const handlePress = () => {
    if (loading) return;
    void onPress();
  };

  const containerStyle = [
    styles.base,
    sizeStyles[size].container,
    variantStyles[variant].container,
    fullWidth && styles.fullWidth,
  ];
  const textStyle = [styles.text, sizeStyles[size].text, variantStyles[variant].text];

  return (
    <Pressable
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        ...containerStyle,
        pressed && !loading && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].spinnerColor} size="small" />
      ) : (
        <View style={styles.row}>
          {leftIcon}
          <Text style={textStyle}>{label}</Text>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});

const sizeStyles = {
  sm: StyleSheet.create({
    container: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36 },
    text: { fontSize: typography.sm },
  }),
  md: StyleSheet.create({
    container: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 44 },
    text: { fontSize: typography.base },
  }),
  lg: StyleSheet.create({
    container: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, minHeight: 52 },
    text: { fontSize: typography.lg },
  }),
} as const;

const variantStyles: Record<
  ButtonVariant,
  { container: object; text: object; spinnerColor: string }
> = {
  primary: {
    container: { backgroundColor: colors.primary },
    text: { color: colors.textInverse },
    spinnerColor: colors.textInverse,
  },
  outline: {
    container: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
    text: { color: colors.primary },
    spinnerColor: colors.primary,
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.text },
    spinnerColor: colors.text,
  },
  danger: {
    container: { backgroundColor: colors.danger },
    text: { color: colors.textInverse },
    spinnerColor: colors.textInverse,
  },
};
