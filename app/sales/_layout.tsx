import React, { createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOperatorAuth } from '@/lib/operator-auth';
import Colors from '@/constants/colors';

const OperatorAuthContext = createContext<ReturnType<typeof useOperatorAuth> | null>(null);

export function useOperator() {
  const ctx = useContext(OperatorAuthContext);
  if (!ctx) throw new Error('useOperator must be used inside SalesLayout');
  return ctx;
}

function SidebarLink({ href, icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Pressable style={[styles.navItem, active && styles.navItemActive]} onPress={() => router.push(href as any)}>
      <Ionicons name={icon} size={18} color={active ? Colors.accent : Colors.textSecondary} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function SalesSidebar({ onLogout }: { onLogout: () => void }) {
  const segments = useSegments();
  const current = segments[segments.length - 1] || 'index';

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View style={styles.logoBox}><Text style={styles.logoText}>TC</Text></View>
        <View>
          <Text style={styles.brandName}>TradieCatch</Text>
          <Text style={styles.brandSub}>Operator Portal</Text>
        </View>
      </View>

      <View style={styles.navList}>
        <SidebarLink href="/sales" icon="grid-outline" label="Pipeline" active={current === 'index' || current === 'sales'} />
        <SidebarLink href="/sales/agenda" icon="calendar-outline" label="Agenda" active={current === 'agenda'} />
        <SidebarLink href="/sales/settings" icon="settings-outline" label="Settings" active={current === 'settings'} />
      </View>

      <Pressable style={styles.logoutBtn} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={16} color={Colors.textTertiary} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

export default function SalesLayout() {
  const auth = useOperatorAuth();

  if (auth.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!auth.isAuthenticated) {
    router.replace('/sales-login' as any);
    return null;
  }

  const handleLogout = () => {
    auth.logout();
    router.replace('/sales-login' as any);
  };

  return (
    <OperatorAuthContext.Provider value={auth}>
      <View style={styles.shell}>
        {Platform.OS === 'web' && <SalesSidebar onLogout={handleLogout} />}
        <View style={styles.main}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
        {Platform.OS !== 'web' && (
          <View style={styles.mobileNav}>
            <SidebarLink href="/sales" icon="grid-outline" label="Pipeline" active={false} />
            <SidebarLink href="/sales/agenda" icon="calendar-outline" label="Agenda" active={false} />
            <SidebarLink href="/sales/settings" icon="settings-outline" label="Settings" active={false} />
          </View>
        )}
      </View>
    </OperatorAuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1923' },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: '#0f1923' },
  sidebar: {
    width: 220,
    backgroundColor: '#131e2c',
    borderRightWidth: 1,
    borderRightColor: '#1f2f42',
    paddingTop: Platform.OS === 'web' ? 67 : 0,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: '#1f2f42', marginBottom: 20,
  },
  logoBox: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  brandName: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 15 },
  brandSub: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 11 },
  navList: { flex: 1, gap: 4 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
  },
  navItemActive: { backgroundColor: Colors.accent + '22' },
  navLabel: { color: '#8a9bb0', fontFamily: 'Inter_500Medium', fontSize: 14 },
  navLabelActive: { color: Colors.accent },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  logoutText: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 13 },
  main: { flex: 1 },
  mobileNav: {
    flexDirection: 'row', backgroundColor: '#131e2c',
    borderTopWidth: 1, borderTopColor: '#1f2f42',
    paddingBottom: 34, paddingTop: 8, paddingHorizontal: 16,
  },
});
