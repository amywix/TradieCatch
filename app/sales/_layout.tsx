import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, getAuthToken } from '@/lib/auth-context';
import { fetch } from 'expo/fetch';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

export default function SalesLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [verifiedOperator, setVerifiedOperator] = useState(false);

  // After auth context restores, double-check operator status against /me
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/sales-login');
      return;
    }
    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${getApiUrl()}api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          router.replace('/sales-login');
          return;
        }
        const me = await res.json();
        if (!me?.isOperator) {
          router.replace('/sales-login');
          return;
        }
        setVerifiedOperator(true);
      } finally {
        setVerifying(false);
      }
    })();
  }, [isLoading, isAuthenticated]);

  const onLogout = async () => {
    await logout();
    router.replace('/sales-login');
  };

  if (isLoading || verifying) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!verifiedOperator || !user) return null;

  const tabs = [
    { key: 'pipeline', label: 'Pipeline', path: '/sales', icon: 'grid-outline' as const },
    { key: 'agenda', label: 'Agenda', path: '/sales/agenda', icon: 'calendar-outline' as const },
    { key: 'settings', label: 'Settings', path: '/sales/settings', icon: 'settings-outline' as const },
  ];

  const isActive = (path: string) => {
    if (path === '/sales') return pathname === '/sales' || /^\/sales\/[^/]+$/.test(pathname || '');
    return pathname === path;
  };

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <Ionicons name="briefcase" size={20} color={Colors.accent} />
          <Text style={styles.brandText}>TradieCatch Sales</Text>
        </View>
        <View style={styles.tabs}>
          {tabs.map(t => (
            <Pressable
              key={t.key}
              onPress={() => router.push(t.path as any)}
              style={[styles.tab, isActive(t.path) && styles.tabActive]}
              testID={`sales-tab-${t.key}`}
            >
              <Ionicons name={t.icon} size={16} color={isActive(t.path) ? Colors.accent : '#fff'} />
              <Text style={[styles.tabText, isActive(t.path) && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.userBox}>
          <Text style={styles.userEmail}>{user.email}</Text>
          <Pressable onPress={onLogout} style={styles.logoutBtn} testID="sales-logout">
            <Ionicons name="log-out-outline" size={16} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  topbar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingHorizontal: 20, paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    borderBottomWidth: 1, borderBottomColor: Colors.primaryLight,
    gap: 24, flexWrap: 'wrap',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  tabs: { flexDirection: 'row', gap: 6, flex: 1, marginLeft: 24 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 14 },
  tabTextActive: { color: Colors.accent, fontFamily: 'Inter_700Bold' },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userEmail: { color: '#A9B5C6', fontSize: 12, fontFamily: 'Inter_400Regular' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  logoutText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 13 },
});
