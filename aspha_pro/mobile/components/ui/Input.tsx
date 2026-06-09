import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/lib/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  helper?: string;
};

/**
 * Input réutilisable. Si `secureTextEntry` est utilisé, un bouton œil est
 * ajouté à droite pour basculer visible/masqué (UX standard mobile).
 * Le composant override `secureTextEntry` localement via un state pour ne pas
 * casser les autoComplete / textContentType d'iOS/Android.
 */
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, helper, style, secureTextEntry, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const isPassword = !!secureTextEntry;
  const effectiveSecure = isPassword && !visible;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={effectiveSecure}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            isPassword && styles.inputWithIcon,
            focused && styles.inputFocused,
            error ? styles.inputError : null,
            style,
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.text,
  },
  inputRow: {
    position: "relative",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: typography.base,
    color: colors.text,
  },
  inputWithIcon: {
    paddingRight: spacing.xxxl, // réserve la place pour le bouton œil
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.danger,
  },
  toggle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: typography.xs,
    color: colors.danger,
  },
  helperText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
});
