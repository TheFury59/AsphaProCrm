// Root layout : providers globaux + auth gate.
//
// Logique de gating (executee a chaque changement de status / user / route) :
//   - status === "idle" | "hydrating"   -> on attend (SplashScreen reste visible)
//   - status === "anonymous"            -> redirect /(auth)/login
//   - status === "authenticated" + must_change_password -> /(auth)/change-password
//   - status === "authenticated" + role intervenant/admin/super_admin -> /(intervenant)/planning
//   - status === "authenticated" + role client -> /(client)/
//
// Le composant ne rend pas directement — il delegue a expo-router (Slot) une fois
// le gate stable, et appelle router.replace(...) sur les transitions.

import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import Toast from "react-native-toast-message";

import { bindAuthBridge, useAuthStore } from "@/stores/auth";
import { colors } from "@/lib/theme";
import { toastConfig } from "@/components/ui/Toast";
import type { UserRole } from "@/types/api";

// Garde la splash visible tant que l'hydration n'est pas finie.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op : si l'API n'est pas dispo (web par ex.) on continue silencieusement.
});

// React Query : config conservative pour mobile (peu de refetch).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// On bind UNE fois au module load (avant le premier render).
bindAuthBridge();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);

  // Bootstrap : hydrate au premier mount.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Cache la splash des qu'on a une decision a prendre.
  useEffect(() => {
    if (status !== "idle" && status !== "hydrating") {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  // Gate de navigation.
  useEffect(() => {
    if (status === "idle" || status === "hydrating") return;

    const inAuthGroup = segments[0] === "(auth)";
    const onChangePassword = inAuthGroup && segments[1] === "change-password";

    if (status === "anonymous") {
      if (!inAuthGroup || onChangePassword) {
        router.replace("/(auth)/login" as never);
      }
      return;
    }

    // authenticated
    if (!user) return; // edge case : status=auth mais user pas encore set

    if (user.must_change_password) {
      if (!onChangePassword) {
        router.replace("/(auth)/change-password" as never);
      }
      return;
    }

    // Pas de must_change_password : on route selon le role.
    if (inAuthGroup) {
      const target = computeHomeRoute(user.role);
      // Cast volontaire : avec typedRoutes la signature est plus stricte que ce
      // que la logique runtime peut prouver ici. Les deux destinations existent.
      router.replace(target as never);
    }
  }, [status, user, segments, router]);

  if (status === "idle" || status === "hydrating") {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <Slot />;
}

function computeHomeRoute(role: UserRole | null): string {
  if (role === "client") return "/(client)/";
  // intervenant, admin, super_admin (et fallback null) -> tabs intervenant
  return "/(intervenant)/planning";
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthGate />
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
