// Stack layout pour le dossier signalements (liste / new / detail).
// Le tab parent a `headerShown: false`, on a donc nos propres headers
// configures ici (et surcharges via Stack.Screen options dans les ecrans).

import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function SignalementsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Signalements" }} />
      <Stack.Screen name="new" options={{ title: "Nouveau signalement", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Signalement" }} />
    </Stack>
  );
}
