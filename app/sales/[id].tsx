import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert,
  ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, queryClient } from '@/lib/query-client';
import Colors from '@/constants/colors';
import type { Lead, LeadMessage } from '@shared/schema';

const STAGES: Lead['stage'][] = ['new', 'qualified', 'demo', 'proposal', 'closed'];

export default function SalesLeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const leadQ = useQuery<Lead>({ queryKey: ['/api/sales/leads', id] });
  const msgsQ = useQuery<LeadMessage[]>({
    queryKey: ['/api/sales/leads', id, 'messages'],
    refetchInterval: 8000,
  });

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (leadQ.data) {
      setEditName(leadQ.data.name || '');
      setEditEmail(leadQ.data.email || '');
      setEditAddress(leadQ.data.address || '');
      setEditNotes(leadQ.data.jobNotes || '');
    }
  }, [leadQ.data?.id]);

  const update = useMutation({
    mutationFn: async (patch: Partial<Lead>) => {
      const res = await apiRequest('PATCH', `/api/sales/leads/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/leads', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/leads'] });
    },
  });

  const intro = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/sales/leads/${id}/intro-sms`)).json(),
    onSuccess: () => msgsQ.refetch(),
    onError: (e: any) => Alert.alert('Could not send', e?.message || ''),
  });

  const send = useMutation({
    mutationFn: async (body: string) => (await apiRequest('POST', `/api/sales/leads/${id}/send`, { body })).json(),
    onSuccess: () => { setDraft(''); msgsQ.refetch(); },
    onError: (e: any) => Alert.alert('Could not send', e?.message || ''),
  });

  const checkout = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/sales/leads/${id}/checkout`)).json(),
    onSuccess: (data) => {
      if (data?.url) {
        if (Platform.OS === 'web') window.open(data.url, '_blank');
        else Linking.openURL(data.url);
      }
    },
    onError: (e: any) => Alert.alert('Checkout failed', e?.message || ''),
  });

  const remove = useMutation({
    mutationFn: async () => (await apiRequest('DELETE', `/api/sales/leads/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/leads'] });
      router.replace('/sales');
    },
  });

  if (leadQ.isLoading || !leadQ.data) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }
  const lead = leadQ.data;

  const eventTime = lead.calendlyEventTime ? new Date(lead.calendlyEventTime as any) : null;
  const eventLabel = eventTime ? eventTime.toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.replace('/sales')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.text} />
          <Text style={styles.backText}>Pipeline</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Delete this lead?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
          ])}
          style={styles.deleteBtn}
          testID="lead-delete"
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {/* Left: details + actions */}
        <View style={styles.col}>
          <View style={styles.cardBlock}>
            <Text style={styles.cardName}>{lead.name || lead.phone}</Text>
            <Text style={styles.cardPhone}>{lead.phone}</Text>
            <View style={styles.metaRow}>
              {lead.paid ? (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.paidBadgeText}>Paid setup fee</Text>
                </View>
              ) : (
                <View style={styles.unpaidBadge}>
                  <Ionicons name="alert-circle" size={14} color="#fff" />
                  <Text style={styles.unpaidBadgeText}>Unpaid</Text>
                </View>
              )}
              {eventLabel && (
                <View style={styles.bookedBadge}>
                  <Ionicons name="calendar" size={14} color="#fff" />
                  <Text style={styles.bookedBadgeText}>{eventLabel}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardBlock}>
            <Text style={styles.sectionLabel}>Stage</Text>
            <View style={styles.stageRow}>
              {STAGES.map(s => (
                <Pressable
                  key={s}
                  onPress={() => update.mutate({ stage: s })}
                  style={[styles.stageBtn, lead.stage === s && styles.stageBtnActive]}
                  testID={`stage-${s}`}
                >
                  <Text style={[styles.stageBtnText, lead.stage === s && styles.stageBtnTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.cardBlock}>
            <Text style={styles.sectionLabel}>Details</Text>
            <Field label="Name" value={editName} onChangeText={setEditName} />
            <Field label="Email" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" />
            <Field label="Address" value={editAddress} onChangeText={setEditAddress} />
            <Field label="Notes" value={editNotes} onChangeText={setEditNotes} multiline />
            <Pressable
              style={styles.saveBtn}
              onPress={() => update.mutate({ name: editName, email: editEmail, address: editAddress, jobNotes: editNotes })}
              testID="lead-save"
            >
              <Text style={styles.saveBtnText}>Save Details</Text>
            </Pressable>
          </View>

          <View style={styles.cardBlock}>
            <Text style={styles.sectionLabel}>Actions</Text>
            <Pressable
              style={styles.actionBtn}
              onPress={() => intro.mutate()}
              disabled={intro.isPending}
              testID="lead-send-intro"
            >
              <Ionicons name="paper-plane-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>{intro.isPending ? 'Sending...' : 'Send Intro SMS'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              onPress={() => checkout.mutate()}
              disabled={checkout.isPending}
              testID="lead-create-checkout"
            >
              <Ionicons name="card-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>{checkout.isPending ? 'Creating...' : 'Create $299 Checkout'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Right: message thread */}
        <View style={styles.col}>
          <View style={[styles.cardBlock, { flex: 1 }]}>
            <Text style={styles.sectionLabel}>SMS Thread</Text>
            <ScrollView style={styles.thread} contentContainerStyle={{ padding: 8, gap: 6 }}>
              {(msgsQ.data || []).length === 0 && (
                <Text style={styles.emptyMsg}>No messages yet. Send an intro SMS to get started.</Text>
              )}
              {(msgsQ.data || []).map(m => (
                <View
                  key={m.id}
                  style={[styles.msg, m.direction === 'outbound' ? styles.msgOut : styles.msgIn]}
                >
                  <Text style={styles.msgBody}>{m.body}</Text>
                  <Text style={styles.msgTime}>
                    {m.direction === 'outbound' ? 'Sent' : 'Received'} • {new Date(m.createdAt as any).toLocaleString('en-AU')}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                testID="composer-input"
              />
              <Pressable
                style={[styles.sendBtn, (!draft.trim() || send.isPending) && { opacity: 0.5 }]}
                disabled={!draft.trim() || send.isPending}
                onPress={() => send.mutate(draft.trim())}
                testID="composer-send"
              >
                <Ionicons name="send" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, ...rest }: any) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, rest.multiline && { minHeight: 60, textAlignVertical: 'top' }]}
        placeholderTextColor={Colors.textTertiary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontFamily: 'Inter_500Medium', color: Colors.text, fontSize: 14 },
  deleteBtn: { padding: 8, borderRadius: 8, backgroundColor: '#FEE' },
  grid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 320, gap: 12 },
  cardBlock: { backgroundColor: Colors.surface, borderRadius: 10, padding: 16 },
  cardName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  cardPhone: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  paidBadgeText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 },
  unpaidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  unpaidBadgeText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 },
  bookedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  bookedBadgeText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 12 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.text, marginBottom: 10 },
  stageRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stageBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: Colors.surfaceSecondary },
  stageBtnActive: { backgroundColor: Colors.accent },
  stageBtnText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text, textTransform: 'capitalize' },
  stageBtnTextActive: { color: '#fff', fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 4 },
  fieldInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: 'Inter_400Regular' },
  saveBtn: { marginTop: 8, backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  actionBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  thread: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, height: 320 },
  emptyMsg: { textAlign: 'center', color: Colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 13, padding: 24 },
  msg: { padding: 10, borderRadius: 8, maxWidth: '85%' },
  msgOut: { alignSelf: 'flex-end', backgroundColor: Colors.accent },
  msgIn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  msgBody: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text },
  msgTime: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.textTertiary, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  composerInput: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: 'Inter_400Regular', minHeight: 40, maxHeight: 120 },
  sendBtn: { backgroundColor: Colors.accent, padding: 12, borderRadius: 8 },
});
