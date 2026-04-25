import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Platform, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOperatorAuth } from '@/lib/operator-auth';
import Colors from '@/constants/colors';

interface Lead {
  id: string; name: string; phone: string; email: string;
  stage: string; paid: boolean;
  calendlyEventTime: string | null;
  jobNotes: string;
}

export default function AgendaScreen() {
  const { authFetch } = useOperatorAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await authFetch('api/sales/leads');
      const data = await res.json();
      if (Array.isArray(data)) setLeads(data);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const upcomingLeads = leads
    .filter(l => l.calendlyEventTime)
    .sort((a, b) => new Date(a.calendlyEventTime!).getTime() - new Date(b.calendlyEventTime!).getTime());

  const now = new Date();
  const upcoming = upcomingLeads.filter(l => new Date(l.calendlyEventTime!) >= now);
  const past = upcomingLeads.filter(l => new Date(l.calendlyEventTime!) < now);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  function DemoCard({ lead, isPast }: { lead: Lead; isPast: boolean }) {
    const date = new Date(lead.calendlyEventTime!);
    return (
      <Pressable style={[styles.card, isPast && styles.cardPast]} onPress={() => router.push(`/sales/${lead.id}` as any)}>
        <View style={styles.cardLeft}>
          <View style={[styles.dateBox, isPast && styles.dateBoxPast]}>
            <Text style={[styles.dateDay, isPast && styles.datePast]}>{date.getDate()}</Text>
            <Text style={[styles.dateMon, isPast && styles.datePast]}>{date.toLocaleString('default', { month: 'short' })}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{lead.name}</Text>
            {!lead.paid && !isPast && (
              <View style={styles.unpaidBadge}>
                <Ionicons name="warning-outline" size={11} color="#f59e0b" />
                <Text style={styles.unpaidText}>Unpaid</Text>
              </View>
            )}
            {lead.paid && (
              <View style={styles.paidBadge}>
                <Ionicons name="checkmark-circle" size={11} color="#10b981" />
                <Text style={styles.paidText}>Paid</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTime}>
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {date.toLocaleDateString()}
          </Text>
          <Text style={styles.cardPhone}>{lead.phone}</Text>
          {lead.jobNotes ? <Text style={styles.cardNotes} numberOfLines={1}>{lead.jobNotes}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color='#506070' />
      </Pressable>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Agenda</Text>
        <Text style={styles.pageSubtitle}>{upcoming.length} upcoming demo{upcoming.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {upcomingLeads.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color='#506070' />
            <Text style={styles.emptyTitle}>No demos booked</Text>
            <Text style={styles.emptyText}>Once leads book via Calendly, their sessions will appear here.</Text>
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Upcoming</Text>
            {upcoming.map(l => <DemoCard key={l.id} lead={l} isPast={false} />)}
          </>
        )}

        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelPast]}>Past</Text>
            {past.map(l => <DemoCard key={l.id} lead={l} isPast />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1923' },
  page: { flex: 1, backgroundColor: '#0f1923', paddingTop: Platform.OS === 'web' ? 67 : 0 },
  header: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1f2f42',
  },
  pageTitle: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 22 },
  pageSubtitle: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 2 },
  content: { padding: 20, paddingBottom: 40 },
  sectionLabel: { color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 10, marginTop: 4 },
  sectionLabelPast: { color: '#506070', marginTop: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#131e2c', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#1f2f42',
  },
  cardPast: { opacity: 0.55 },
  cardLeft: { alignItems: 'center' },
  dateBox: {
    width: 48, height: 52, borderRadius: 10,
    backgroundColor: Colors.accent + '22', borderWidth: 1, borderColor: Colors.accent + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  dateBoxPast: { backgroundColor: '#1f2f42', borderColor: '#2a3a50' },
  dateDay: { color: Colors.accent, fontFamily: 'Inter_700Bold', fontSize: 20 },
  dateMon: { color: Colors.accent, fontFamily: 'Inter_500Medium', fontSize: 11 },
  datePast: { color: '#506070' },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardName: { color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1 },
  unpaidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f59e0b22', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2,
  },
  unpaidText: { color: '#f59e0b', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#10b98120', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2,
  },
  paidText: { color: '#10b981', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  cardTime: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 2 },
  cardPhone: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardNotes: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyTitle: { color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  emptyText: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', maxWidth: 320 },
});
