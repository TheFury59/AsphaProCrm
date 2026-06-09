// Stack layout pour le dossier devis (liste / detail).
// Le tab parent a `headerShown: false`, on configure ici nos propres headers.

import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function DevisStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mes devis" }} />
      <Stack.Screen name="[id]" options={{ title: "Devis" }} />
    </Stack>
  );
}
