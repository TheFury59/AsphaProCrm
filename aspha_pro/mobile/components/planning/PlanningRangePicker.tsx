// Modal bottom-sheet pour selectionner la periode du planning intervenant.
//
// L'intervenant choisit :
//  - une vue : jour / semaine / mois
//  - une date de reference (DateTimePicker natif)
//  - des fleches precedent / suivant pour naviguer dans le temps
//
// La range effective est calculee depuis (viewMode, referenceDate) :
//  - day   : [referenceDate@00:00, referenceDate@23:59]
//  - week  : [lundi@00:00,         dimanche@23:59]
//  - month : [1er@00:00,           dernier@23:59]

import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import {
  addDays,
  formatDateLong,
  formatMonthYear,
  formatRange,
  startOfWeek,
  startOfMonth,
  startOfToday,
} from "@/lib/date";

// Limite max de consultation des RDV passés (UX guidée — au-delà, l'app
// n'est plus utile pour un intervenant terrain qui consulte son historique
// récent).
const MAX_DAYS_IN_PAST = 30;
import { colors, radius, spacing, typography } from "@/lib/theme";

export type PlanningViewMode = "day" | "week" | "month";

type Props = {
  visible: boolean;
  viewMode: PlanningViewMode;
  referenceDate: Date;
  onClose: () => void;
  onChange: (viewMode: PlanningViewMode, referenceDate: Date) => void;
};

/** Libelle court pour le label de periode actuel. */
export function periodLabel(viewMode: PlanningViewMode, referenceDate: Date): string {
  switch (viewMode) {
    case "day":
      return formatDateLong(referenceDate);
    case "week": {
      const from = startOfWeek(referenceDate);
      const to = addDays(from, 6);
      return formatRange(from, to);
    }
    case "month":
      return formatMonthYear(referenceDate);
  }
}

export function PlanningRangePicker({
  visible,
  viewMode,
  referenceDate,
  onClose,
  onChange,
}: Props) {
  // State local pour pouvoir basculer sans bloquer le parent ; on apply au close.
  const [localMode, setLocalMode] = useState<PlanningViewMode>(viewMode);
  const [localDate, setLocalDate] = useState<Date>(referenceDate);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleApply = () => {
    onChange(localMode, localDate);
    onClose();
  };

  const handleToday = () => {
    setLocalDate(startOfToday());
  };

  // Date minimale autorisée (1 mois dans le passé).
  const minDate = useMemo(() => {
    const d = startOfToday();
    d.setDate(d.getDate() - MAX_DAYS_IN_PAST);
    return d;
  }, []);

  // Presets de raccourci pour accéder vite à l'historique récent ou aux
  // périodes proches sans devoir tapoter les flèches.
  const applyPreset = (mode: PlanningViewMode, ref: Date) => {
    setLocalMode(mode);
    setLocalDate(ref);
  };
  const PRESETS = [
    {
      label: "Cette semaine",
      onPress: () => applyPreset("week", startOfToday()),
    },
    {
      label: "Semaine dernière",
      onPress: () => applyPreset("week", addDays(startOfWeek(startOfToday()), -7)),
    },
    {
      label: "Ce mois-ci",
      onPress: () => applyPreset("month", startOfMonth(startOfToday())),
    },
    {
      label: "Mois dernier",
      onPress: () => {
        const lastMonth = startOfMonth(startOfToday());
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        applyPreset("month", lastMonth);
      },
    },
  ];

  const stepBack = () => {
    const next = new Date(localDate);
    switch (localMode) {
      case "day":
        next.setDate(next.getDate() - 1);
        break;
      case "week":
        next.setDate(next.getDate() - 7);
        break;
      case "month":
        next.setMonth(next.getMonth() - 1);
        break;
    }
    // Bloque la navigation au-delà de MAX_DAYS_IN_PAST jours dans le passé.
    if (next < minDate) {
      return;
    }
    setLocalDate(next);
  };

  const stepForward = () => {
    const next = new Date(localDate);
    switch (localMode) {
      case "day":
        next.setDate(next.getDate() + 1);
        break;
      case "week":
        next.setDate(next.getDate() + 7);
        break;
      case "month":
        next.setMonth(next.getMonth() + 1);
        break;
    }
    setLocalDate(next);
  };

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setPickerOpen(false);
    }
    if (event.type === "set" && date) {
      // Normalise selon le mode (lundi de la semaine, 1er du mois).
      if (localMode === "week") {
        setLocalDate(startOfWeek(date));
      } else if (localMode === "month") {
        setLocalDate(startOfMonth(date));
      } else {
        setLocalDate(date);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Choisir la période</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Segmented : jour / semaine / mois */}
          <View style={styles.segmented}>
            {(["day", "week", "month"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setLocalMode(m)}
                style={[
                  styles.segBtn,
                  localMode === m && styles.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segBtnText,
                    localMode === m && styles.segBtnTextActive,
                  ]}
                >
                  {modeLabel(m)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Presets rapides — accès direct à l'historique récent */}
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={p.onPress}
                style={({ pressed }) => [
                  styles.presetBtn,
                  pressed && styles.presetBtnPressed,
                ]}
              >
                <Text style={styles.presetBtnText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Affichage periode actuelle + navigation */}
          <View style={styles.navRow}>
            <Pressable onPress={stepBack} style={styles.navBtn} hitSlop={6}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            <View style={styles.navLabelWrap}>
              <Text style={styles.navLabel} numberOfLines={2}>
                {periodLabel(localMode, localDate)}
              </Text>
            </View>
            <Pressable onPress={stepForward} style={styles.navBtn} hitSlop={6}>
              <Ionicons name="chevron-forward" size={22} color={colors.primary} />
            </Pressable>
          </View>

          {/* Bouton ouvrir le date picker natif */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.dateBtn, pressed && styles.dateBtnPressed]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dateBtnText}>Choisir une date précise</Text>
          </Pressable>

          {pickerOpen ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={localDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                locale="fr-FR"
                minimumDate={minDate}
                onChange={onPickerChange}
              />
              {Platform.OS === "ios" ? (
                <Pressable
                  onPress={() => setPickerOpen(false)}
                  style={styles.pickerDoneBtn}
                >
                  <Text style={styles.pickerDoneText}>Valider</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Footer actions */}
          <View style={styles.footer}>
            <Pressable onPress={handleToday} style={styles.todayBtn}>
              <Ionicons name="today-outline" size={16} color={colors.primary} />
              <Text style={styles.todayBtnText}>Aujourd'hui</Text>
            </Pressable>
            <Pressable onPress={handleApply} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Voir mes RDV</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function modeLabel(m: PlanningViewMode): string {
  switch (m) {
    case "day":
      return "Jour";
    case "week":
      return "Semaine";
    case "month":
      return "Mois";
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  segmented: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
    borderRadius: radius.full,
  },
  segBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.full,
  },
  segBtnActive: {
    backgroundColor: colors.background,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  segBtnText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: "600",
  },
  segBtnTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  presetBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetBtnPressed: {
    opacity: 0.65,
    backgroundColor: colors.surfaceMuted,
  },
  presetBtnText: {
    fontSize: typography.xs,
    color: colors.text,
    fontWeight: "600",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabelWrap: {
    flex: 1,
    alignItems: "center",
  },
  navLabel: {
    fontSize: typography.base,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    textTransform: "capitalize",
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateBtnPressed: {
    opacity: 0.7,
  },
  dateBtnText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: "600",
  },
  pickerWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  pickerDoneBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  pickerDoneText: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  todayBtnText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: typography.sm,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    color: colors.textInverse,
    fontWeight: "700",
    fontSize: typography.base,
  },
});
