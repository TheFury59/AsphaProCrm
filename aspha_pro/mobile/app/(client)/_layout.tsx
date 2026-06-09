// Tabs layout cote client : Accueil / Devis / Factures / Demandes / Profil.
//
// La tab `demandes` est un dossier avec ses sous-routes (index, new, [id]) ; on
// utilise getFocusedRouteNameFromRoute pour masquer la tab bar sur les ecrans
// new et [id] (sinon le clavier du composer mange le composer en chevauchant
// avec la tab bar — bug deja rencontre cote intervenant cf. LRN).
//
// La tab `devis/[id]` est masquee de la tab bar (href: null) — accessible par
// push depuis la liste devis.

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";

import { colors } from "@/lib/theme";

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="devis"
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? "index";
          const hideTabBar = focused === "[id]";
          return {
            title: "Devis",
            headerShown: false,
            tabBarStyle: hideTabBar ? { display: "none" as const } : undefined,
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          };
        }}
      />
      <Tabs.Screen
        name="factures"
        options={{
          title: "Factures",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="demandes"
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? "index";
          const hideTabBar = focused === "[id]" || focused === "new";
          return {
            title: "Demandes",
            headerShown: false,
            tabBarStyle: hideTabBar ? { display: "none" as const } : undefined,
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
            ),
          };
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
