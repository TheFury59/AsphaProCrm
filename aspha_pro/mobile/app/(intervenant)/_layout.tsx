import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/lib/theme";

export default function IntervenantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="planning"
        options={{
          title: "Planning",
          // Header custom dans planning.tsx (titre + sous-titre + bouton today/refresh).
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="badgeage"
        options={{
          title: "Badgeage",
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="signalements"
        options={{
          title: "Signalements",
          // Le dossier signalements/ contient index/new/[id] ; les sous-pages
          // ont leur propre header configuré via Stack.Screen options.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="warning-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messagerie"
        options={{
          // Tab masquée en V1 : toute la communication passe par les fils de
          // signalements. On la garde dans le code pour V2 (DM directe avec
          // les admins / collègues, hors tickets).
          href: null,
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      {/* Route detail RDV : accessible par push depuis le planning, masquee de la
          tab bar (href: null) et avec son propre header (titre dynamique). */}
      <Tabs.Screen
        name="rdv/[id]"
        options={{
          href: null,
          title: "Detail du RDV",
        }}
      />
    </Tabs>
  );
}
