import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

function SalesGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token, isLoading, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !token) {
      router.replace("/sales-login");
      return;
    }
    (async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/sales/leads`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          setAllowed(true);
        } else if (res.status === 403) {
          await logout();
          router.replace("/sales-login");
        } else {
          router.replace("/sales-login");
        }
      } catch {
        router.replace("/sales-login");
      } finally {
        setChecking(false);
      }
    })();
  }, [user, token, isLoading]);

  if (isLoading || checking || !allowed) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

function HeaderNav() {
  const router = useRouter();
  const segments = useSegments();
  const { logout } = useAuth();
  const current = segments[1] || "index";

  const tabs = [
    { key: "index", label: "Pipeline", path: "/sales" },
    { key: "agenda", label: "Agenda", path: "/sales/agenda" },
    { key: "settings", label: "Settings", path: "/sales/settings" },
  ];

  return (
    <View style={styles.header}>
      <Text style={styles.brand}>TradieCatch Sales</Text>
      <View style={styles.navRow}>
        {tabs.map(t => {
          const active = current === t.key || (t.key === "index" && (current === "index" || segments.length === 1));
          return (
            <Pressable
              key={t.key}
              onPress={() => router.push(t.path as any)}
              style={[styles.navBtn, active && styles.navBtnActive]}
              testID={`sales-nav-${t.key}`}
            >
              <Text style={[styles.navText, active && styles.navTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={async () => { await logout(); router.replace("/sales-login"); }}
          style={[styles.navBtn, styles.logoutBtn]}
          testID="sales-nav-logout"
        >
          <Text style={[styles.navText, { color: Colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SalesLayout() {
  return (
    <SalesGate>
      <View style={styles.root}>
        <HeaderNav />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }} />
      </View>
    </SalesGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === "web" ? 16 : 50,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight,
  },
  brand: { color: Colors.white, fontSize: 18, fontFamily: "Inter_700Bold" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  navBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, backgroundColor: "transparent",
  },
  navBtnActive: { backgroundColor: Colors.primaryLight },
  logoutBtn: { marginLeft: 6 },
  navText: { color: Colors.white, opacity: 0.85, fontFamily: "Inter_500Medium", fontSize: 14 },
  navTextActive: { opacity: 1, color: Colors.accent, fontFamily: "Inter_600SemiBold" },
});
