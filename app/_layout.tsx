import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
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
  const { isAuthenticated, isLoading } = useAuth();
  usePushNotifications();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // Capture window.location.pathname synchronously at first render (before any routing).
  // This is the only reliable way to detect the initial URL on web before expo-router
  // has had a chance to update the pathname hook.
  const initialPath = useRef(
    typeof window !== 'undefined' ? window.location.pathname : ''
  ).current;

  const isSalesPath = (p: string) =>
    p.startsWith('/sales-login') || p.startsWith('/sales');

  // True if the user is on a sales page.
  // Use initialPath as a fallback only when expo-router hasn't resolved the pathname yet
  // (pathname is empty or root "/") to prevent the auth redirect from firing before
  // expo-router has had a chance to read the real URL from window.location.
  const pathnameResolved = pathname !== '' && pathname !== '/';
  const isOnSalesPage =
    isSalesPath(pathname) ||
    (!pathnameResolved && isSalesPath(initialPath));

  useEffect(() => {
    if (isLoading || isOnSalesPage) return;

    const first = segments[0] || '';
    const onLoginScreen = first === 'login';

    if (!isAuthenticated && !onLoginScreen) {
      router.replace('/login');
    } else if (isAuthenticated && onLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, isOnSalesPage]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="book-job" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="send-sms" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-call" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-template" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="conversation" options={{ headerShown: false }} />
      <Stack.Screen name="sales-login" options={{ headerShown: false }} />
      <Stack.Screen name="sales" options={{ headerShown: false }} />
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
