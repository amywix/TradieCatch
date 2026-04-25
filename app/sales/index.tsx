import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOperatorAuth } from '@/lib/operator-auth';
import Colors from '@/constants/colors';

type LeadStage = 'new' | 'qualified' | 'demo' | 'proposal' | 'closed';

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  jobNotes: string;
  stage: LeadStage;
  paid: boolean;
  calendlyEventTime: string | null;
  calendlyEventUri: string | null;
  stripeSessionId: string | null;
  outcome: string;
  createdAt: string;
  updatedAt: string;
}

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#4b6bfb' },
  { key: 'qualified', label: 'Qualified', color: '#a78bfa' },
  { key: 'demo', label: 'Demo', color: '#f59e0b' },
  { key: 'proposal', label: 'Proposal', color: '#10b981' },
  { key: 'closed', label: 'Closed', color: '#6b7280' },
];

function LeadCard({ lead, onPress, onStageChange }: {
  lead: Lead;
  onPress: () => void;
  onStageChange: (id: string, stage: LeadStage) => void;
}) {
  const stageInfo = STAGES.find(s => s.key === lead.stage)!;
  const bookedAt = lead.calendlyEventTime ? new Date(lead.calendlyEventTime) : null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{lead.name}</Text>
        {lead.paid && (
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={10} color="#10b981" />
            <Text style={styles.paidText}>Paid</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardPhone}>{lead.phone}</Text>
      {bookedAt && (
        <View style={styles.bookedRow}>
          <Ionicons name="calendar-outline" size={12} color={Colors.accent} />
          <Text style={styles.bookedText}>{bookedAt.toLocaleDateString()} {bookedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      )}
      {lead.jobNotes ? <Text style={styles.cardNotes} numberOfLines={2}>{lead.jobNotes}</Text> : null}
      <View style={styles.cardFooter}>
        <View style={[styles.stageDot, { backgroundColor: stageInfo.color }]} />
        <Text style={styles.stageText}>{stageInfo.label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.cardDate}>{new Date(lead.createdAt).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  );
}

function AddLeadModal({ visible, onClose, onAdd, authFetch }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
  authFetch: ReturnType<typeof useOperatorAuth>['authFetch'];
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes(''); setError(''); };

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required'); return; }
    setLoading(true);
    try {
      const res = await authFetch('api/sales/leads', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(), jobNotes: notes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add lead'); return; }
      onAdd(data);
      reset();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Lead</Text>
            <Pressable onPress={() => { reset(); onClose(); }} hitSlop={8}>
              <Ionicons name="close" size={20} color='#8a9bb0' />
            </Pressable>
          </View>
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <Text style={styles.modalLabel}>Name *</Text>
          <TextInput style={styles.modalInput} value={name} onChangeText={setName} placeholder="John Smith" placeholderTextColor='#506070' />
          <Text style={styles.modalLabel}>Phone *</Text>
          <TextInput style={styles.modalInput} value={phone} onChangeText={setPhone} placeholder="+61 4xx xxx xxx" placeholderTextColor='#506070' keyboardType="phone-pad" />
          <Text style={styles.modalLabel}>Email</Text>
          <TextInput style={styles.modalInput} value={email} onChangeText={setEmail} placeholder="john@example.com" placeholderTextColor='#506070' keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.modalLabel}>Address</Text>
          <TextInput style={styles.modalInput} value={address} onChangeText={setAddress} placeholder="123 Main St" placeholderTextColor='#506070' />
          <Text style={styles.modalLabel}>Job Notes</Text>
          <TextInput style={[styles.modalInput, { minHeight: 72, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="What are they looking for?" placeholderTextColor='#506070' multiline />
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalAddBtn, loading && { opacity: 0.6 }]} onPress={handleAdd} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalAddText}>Add Lead</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PipelineBoard() {
  const { authFetch } = useOperatorAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      const res = await authFetch('api/sales/leads');
      const data = await res.json();
      if (Array.isArray(data)) setLeads(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const filtered = search
    ? leads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search))
    : leads;

  const byStage = (stage: LeadStage) => filtered.filter(l => l.stage === stage);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Pipeline</Text>
        <View style={styles.topBarRight}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={15} color='#506070' />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search leads…"
              placeholderTextColor='#506070'
            />
          </View>
          <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Lead</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.board} showsHorizontalScrollIndicator={false}>
        {STAGES.map(stage => (
          <View key={stage.key} style={styles.column}>
            <View style={styles.colHeader}>
              <View style={[styles.colDot, { backgroundColor: stage.color }]} />
              <Text style={styles.colTitle}>{stage.label}</Text>
              <View style={styles.colCount}>
                <Text style={styles.colCountText}>{byStage(stage.key).length}</Text>
              </View>
            </View>
            <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>
              {byStage(stage.key).map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onPress={() => router.push(`/sales/${lead.id}` as any)}
                  onStageChange={() => {}}
                />
              ))}
              {byStage(stage.key).length === 0 && (
                <View style={styles.emptyCol}>
                  <Text style={styles.emptyColText}>No leads</Text>
                </View>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <AddLeadModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={lead => setLeads(prev => [lead, ...prev])}
        authFetch={authFetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1923' },
  page: { flex: 1, backgroundColor: '#0f1923', paddingTop: Platform.OS === 'web' ? 67 : 0 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1f2f42',
  },
  pageTitle: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 22 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#131e2c', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#1f2f42',
    minWidth: 200,
  },
  searchInput: { color: '#e8edf4', fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1, outlineStyle: 'none' } as any,
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  board: { padding: 16, gap: 12, alignItems: 'flex-start' },
  column: {
    width: 260,
    backgroundColor: '#131e2c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2f42',
    maxHeight: Platform.OS === 'web' ? 'calc(100vh - 160px)' as any : 600,
    overflow: 'hidden',
  },
  colHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1f2f42',
  },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  colCount: {
    backgroundColor: '#1f2f42', borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  colCountText: { color: '#8a9bb0', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  colScroll: { padding: 10 },
  card: {
    backgroundColor: '#1a2535', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#2a3a50',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardName: { color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#10b98120', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  paidText: { color: '#10b981', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  cardPhone: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 4 },
  bookedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  bookedText: { color: Colors.accent, fontFamily: 'Inter_500Medium', fontSize: 11 },
  cardNotes: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stageText: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 11 },
  cardDate: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 11 },
  emptyCol: { alignItems: 'center', paddingVertical: 24 },
  emptyColText: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 13 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#1a2535', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, borderWidth: 1, borderColor: '#2a3a50' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 18 },
  modalError: { color: '#f87171', fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 12 },
  modalLabel: { color: '#8a9bb0', fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#0f1923', borderWidth: 1, borderColor: '#2a3a50', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, color: '#e8edf4',
    fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: { flex: 1, backgroundColor: '#1f2f42', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#8a9bb0', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  modalAddBtn: { flex: 1, backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  modalAddText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
