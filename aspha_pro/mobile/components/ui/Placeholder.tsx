import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/ui/Screen";
import { colors, spacing, typography } from "@/lib/theme";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  sprint?: string;
};

export function Placeholder({ icon = "construct-outline", title, subtitle, sprint }: Props) {
  return (
    <Screen>
      <View style={styles.wrapper}>
        <Ionicons name={icon} size={56} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {sprint ? <Text style={styles.sprint}>Bientot - {sprint}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  sprint: {
    marginTop: spacing.lg,
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.primary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
});
