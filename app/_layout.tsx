import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { DataProvider } from "@/lib/data-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { usePushNotifications } from "@/lib/use-push-notifications";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  usePushNotifications();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const first = segments[0] || '';
    const onLoginScreen = first === 'login';
    const onChangePasswordScreen = first === 'change-password';
    const mustChangePassword = !!user?.mustChangePassword;

    if (!isAuthenticated && !onLoginScreen) {
      router.replace('/login');
      return;
    }

    if (isAuthenticated && mustChangePassword && !onChangePasswordScreen) {
      // Force-redirect to the password change screen and block everything else
      router.replace('/change-password');
      return;
    }

    if (isAuthenticated && !mustChangePassword && (onLoginScreen || onChangePasswordScreen)) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, user?.mustChangePassword]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="admin-create-tradie" options={{ headerShown: true, title: "Create Tradie Account", presentation: 'modal' }} />
      <Stack.Screen name="book-job" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-call" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="conversation" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <AuthProvider>
              <AuthGate>
                <DataProvider>
                  <SubscriptionProvider>
                    <RootLayoutNav />
                  </SubscriptionProvider>
                </DataProvider>
              </AuthGate>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
