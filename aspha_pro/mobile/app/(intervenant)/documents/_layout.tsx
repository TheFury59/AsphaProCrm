// Stack layout pour le dossier documents (liste + upload).
// Le tab parent a `headerShown: false`, on a donc nos propres headers
// configures ici (et surcharges via Stack.Screen options dans les ecrans).

import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function DocumentsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mes documents" }} />
      <Stack.Screen
        name="upload"
        options={{ title: "Ajouter un document", presentation: "modal" }}
      />
    </Stack>
  );
}
