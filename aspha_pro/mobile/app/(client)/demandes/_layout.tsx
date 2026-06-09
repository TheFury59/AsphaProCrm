// Stack layout pour le dossier demandes (liste / new / detail).
// Le tab parent a `headerShown: false`, on configure ici nos propres headers.

import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function DemandesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mes demandes" }} />
      <Stack.Screen name="new" options={{ title: "Nouvelle demande", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Demande" }} />
    </Stack>
  );
}
