import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import type { Lead } from '@shared/schema';

export default function SalesAgenda() {
  const router = useRouter();
  const { data = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/sales/agenda'],
    refetchInterval: 30000,
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.h1}>Upcoming Demos</Text>
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.empty}>No demos booked yet.</Text>
          <Text style={styles.emptySub}>When a lead picks a time on Calendly, it will show up here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {data.map(lead => {
            const t = new Date(lead.calendlyEventTime as any);
            const label = t.toLocaleString('en-AU', {
              weekday: 'long', day: 'numeric', month: 'short',
              hour: 'numeric', minute: '2-digit', hour12: true,
            });
            return (
              <Pressable
                key={lead.id}
                style={styles.row}
                onPress={() => router.push(`/sales/${lead.id}`)}
                testID={`agenda-${lead.id}`}
              >
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{t.getDate()}</Text>
                  <Text style={styles.monthText}>{t.toLocaleString('en-AU', { month: 'short' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{lead.name || lead.phone}</Text>
                  <Text style={styles.detail}>{label}</Text>
                  <Text style={styles.detail}>{lead.phone}</Text>
                </View>
                {!lead.paid ? (
                  <View style={styles.warn}>
                    <Ionicons name="alert-circle" size={14} color="#fff" />
                    <Text style={styles.warnText}>Unpaid</Text>
                  </View>
                ) : (
                  <View style={styles.ok}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.okText}>Paid</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.text, marginTop: 12 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  h1: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, padding: 14, borderRadius: 10,
  },
  timeBox: {
    width: 56, height: 56, borderRadius: 8, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  timeText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 22 },
  monthText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 11 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 15, color: Colors.text },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  warnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 },
  ok: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  okText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 },
});
