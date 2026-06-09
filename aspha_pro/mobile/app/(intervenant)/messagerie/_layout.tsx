// Stack layout pour le dossier messagerie (liste / new / detail).
// Le tab parent a `headerShown: false`, on a donc nos propres headers
// configures ici (et surcharges via Stack.Screen options dans les ecrans).

import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function MessagerieStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Messages" }} />
      <Stack.Screen
        name="new"
        options={{ title: "Nouvelle conversation", presentation: "modal" }}
      />
      <Stack.Screen name="[id]" options={{ title: "Conversation" }} />
    </Stack>
  );
}
