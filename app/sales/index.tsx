import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, queryClient } from '@/lib/query-client';
import Colors from '@/constants/colors';
import type { Lead } from '@shared/schema';

const STAGES: { key: Lead['stage']; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#6B7A8D' },
  { key: 'qualified', label: 'Qualified', color: '#3B82F6' },
  { key: 'demo', label: 'Demo', color: '#8B5CF6' },
  { key: 'proposal', label: 'Proposal', color: '#F59E0B' },
  { key: 'closed', label: 'Closed', color: '#10B981' },
];

export default function SalesPipelineScreen() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  const { data: leads = [], isLoading, refetch } = useQuery<Lead[]>({
    queryKey: ['/api/sales/leads'],
    refetchInterval: 15000,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Lead['stage'] }) => {
      const res = await apiRequest('PATCH', `/api/sales/leads/${id}`, { stage });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/sales/leads'] }),
  });

  const groupedByStage: Record<string, Lead[]> = STAGES.reduce((acc, s) => ({ ...acc, [s.key]: [] }), {});
  for (const l of leads) {
    if (groupedByStage[l.stage]) groupedByStage[l.stage].push(l);
    else groupedByStage.new.push(l);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.h1}>Pipeline</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
          testID="sales-add-lead-btn"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Lead</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }} contentContainerStyle={styles.boardRow}>
          {STAGES.map(stage => (
            <View key={stage.key} style={styles.column} testID={`sales-column-${stage.key}`}>
              <View style={[styles.columnHeader, { borderTopColor: stage.color }]}>
                <Text style={styles.columnTitle}>{stage.label}</Text>
                <Text style={styles.columnCount}>{groupedByStage[stage.key]?.length ?? 0}</Text>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, gap: 8 }}>
                {(groupedByStage[stage.key] || []).map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onOpen={() => router.push(`/sales/${lead.id}`)}
                    onChangeStage={(newStage) => updateStage.mutate({ id: lead.id, stage: newStage })}
                  />
                ))}
                {(groupedByStage[stage.key] || []).length === 0 && (
                  <Text style={styles.emptyText}>No leads</Text>
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}

      <AddLeadModal visible={showAdd} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); refetch(); }} />
    </View>
  );
}

function LeadCard({ lead, onOpen, onChangeStage }: { lead: Lead; onOpen: () => void; onChangeStage: (s: Lead['stage']) => void }) {
  const eventTime = lead.calendlyEventTime ? new Date(lead.calendlyEventTime as any) : null;
  const eventLabel = eventTime ? eventTime.toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null;
  return (
    <Pressable style={styles.card} onPress={onOpen} testID={`sales-card-${lead.id}`}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{lead.name || lead.phone}</Text>
        {lead.paid && (
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#fff" />
            <Text style={styles.paidBadgeText}>Paid</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardPhone}>{lead.phone}</Text>
      {eventLabel && (
        <View style={styles.bookedRow}>
          <Ionicons name="calendar" size={12} color={Colors.accent} />
          <Text style={styles.bookedText}>{eventLabel}</Text>
        </View>
      )}
      {lead.jobNotes ? <Text style={styles.cardNotes} numberOfLines={2}>{lead.jobNotes}</Text> : null}
      <View style={styles.stagePicker}>
        {STAGES.map(s => (
          <Pressable
            key={s.key}
            onPress={(e) => { e.stopPropagation?.(); onChangeStage(s.key); }}
            style={[styles.stageChip, lead.stage === s.key && { backgroundColor: s.color }]}
          >
            <Text style={[styles.stageChipText, lead.stage === s.key && { color: '#fff' }]}>{s.label[0]}</Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

function AddLeadModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [jobNotes, setJobNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setName(''); setPhone(''); setEmail(''); setAddress(''); setJobNotes(''); };

  const submit = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Please enter a phone number.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('POST', '/api/sales/leads', { name, phone, email, address, jobNotes });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Lead</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></Pressable>
          </View>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Bob's Electrical" testID="lead-name" />
          <Field label="Phone *" value={phone} onChangeText={setPhone} placeholder="+61..." keyboardType="phone-pad" testID="lead-phone" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="bob@example.com" keyboardType="email-address" testID="lead-email" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="" testID="lead-address" />
          <Field label="Notes" value={jobNotes} onChangeText={setJobNotes} placeholder="Where you found them, what they need..." multiline testID="lead-notes" />
          <Pressable
            style={[styles.modalSubmit, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={submit}
            testID="lead-submit"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Add Lead</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Field(props: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={[styles.fieldInput, props.multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        placeholderTextColor={Colors.textTertiary}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  h1: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  boardRow: { padding: 16, gap: 12, alignItems: 'stretch' },
  column: { width: 280, backgroundColor: Colors.surface, borderRadius: 10, overflow: 'hidden', alignSelf: 'stretch' },
  columnHeader: {
    paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  columnTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.text },
  columnCount: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.textSecondary, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  card: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.text },
  cardPhone: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardNotes: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  paidBadgeText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10 },
  bookedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  bookedText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.text },
  stagePicker: { flexDirection: 'row', gap: 4, marginTop: 8 },
  stageChip: { width: 24, height: 24, borderRadius: 4, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  stageChipText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, textAlign: 'center', padding: 20 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 20, width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 4 },
  fieldInput: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: 'Inter_400Regular',
  },
  modalSubmit: { marginTop: 12, backgroundColor: Colors.accent, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSubmitText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
});
