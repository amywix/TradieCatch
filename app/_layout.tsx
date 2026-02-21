import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import Purchases from "react-native-purchases";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { DataProvider } from "@/lib/data-context";
import { apiRequest } from "@/lib/query-client";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="book-job" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="send-sms" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="add-call" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-template" options={{ headerShown: false, presentation: 'modal' }} />
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
    async function initRevenueCat() {
      try {
        const res = await apiRequest('GET', '/api/config');
        const config = await res.json();
        if (config.revenueCatApiKey) {
          Purchases.configure({ apiKey: config.revenueCatApiKey });
        }
      } catch (err) {
        console.log("RevenueCat init error:", err);
      }
    }
    initRevenueCat();
  }, []);

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
            <DataProvider>
              <RootLayoutNav />
            </DataProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
