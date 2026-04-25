import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Platform, Alert, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOperatorAuth } from '@/lib/operator-auth';
import Colors from '@/constants/colors';

type LeadStage = 'new' | 'qualified' | 'demo' | 'proposal' | 'closed';

interface Lead {
  id: string; name: string; phone: string; email: string;
  address: string; jobNotes: string; stage: LeadStage; paid: boolean;
  calendlyEventTime: string | null; stripeSessionId: string | null;
  outcome: string; createdAt: string; updatedAt: string;
}

interface Message {
  id: string; leadId: string; direction: 'inbound' | 'outbound';
  body: string; twilioSid: string; createdAt: string;
}

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#4b6bfb' },
  { key: 'qualified', label: 'Qualified', color: '#a78bfa' },
  { key: 'demo', label: 'Demo', color: '#f59e0b' },
  { key: 'proposal', label: 'Proposal', color: '#10b981' },
  { key: 'closed', label: 'Closed', color: '#6b7280' },
];

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authFetch } = useOperatorAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsBody, setSmsBody] = useState('');
  const [sendingIntro, setSendingIntro] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [sendingPayment, setSendingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const scrollRef = useRef<ScrollView>(null);

  const fetchData = useCallback(async () => {
    try {
      const [leadRes, msgRes] = await Promise.all([
        authFetch(`api/sales/leads/${id}`),
        authFetch(`api/sales/leads/${id}/messages`),
      ]);
      const leadData = await leadRes.json();
      const msgData = await msgRes.json();
      setLead(leadData);
      setEditData(leadData);
      if (Array.isArray(msgData)) setMessages(msgData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Check for payment success from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') === 'success') {
        handleVerifyPayment(params.get('session_id') || undefined);
      }
    }
  }, []);

  const handleSendIntro = async () => {
    setSendingIntro(true);
    try {
      await authFetch(`api/sales/leads/${id}/send-intro`, { method: 'POST' });
      await fetchData();
    } finally {
      setSendingIntro(false);
    }
  };

  const handleSendSms = async () => {
    if (!smsBody.trim()) return;
    setSendingSms(true);
    try {
      await authFetch(`api/sales/leads/${id}/send-sms`, {
        method: 'POST',
        body: JSON.stringify({ body: smsBody.trim() }),
      });
      setSmsBody('');
      await fetchData();
    } finally {
      setSendingSms(false);
    }
  };

  const handleSendPaymentLink = async () => {
    setSendingPayment(true);
    try {
      const res = await authFetch(`api/sales/leads/${id}/create-payment-link`, { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === 'web') {
          window.open(data.url, '_blank');
        }
        // Also SMS the link to the lead automatically via the backend
        await authFetch(`api/sales/leads/${id}/send-sms`, {
          method: 'POST',
          body: JSON.stringify({ body: `Here's your secure payment link to lock in your TradieCatch setup: ${data.url}` }),
        });
        await fetchData();
      }
    } finally {
      setSendingPayment(false);
    }
  };

  const handleVerifyPayment = async (sessionId?: string) => {
    setVerifyingPayment(true);
    try {
      const body: any = {};
      if (sessionId) body.sessionId = sessionId;
      const res = await authFetch(`api/sales/leads/${id}/verify-payment`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.paid) {
        setLead(data.lead);
        Alert.alert?.('Payment confirmed! Lead marked as paid.');
      }
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleStageChange = async (stage: LeadStage) => {
    try {
      const res = await authFetch(`api/sales/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      setLead(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`api/sales/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      setLead(data);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }
  if (!lead) {
    return <View style={styles.center}><Text style={styles.errorText}>Lead not found</Text></View>;
  }

  const stageInfo = STAGES.find(s => s.key === lead.stage) || STAGES[0];
  const bookedAt = lead.calendlyEventTime ? new Date(lead.calendlyEventTime) : null;

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color='#8a9bb0' />
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>{lead.name}</Text>
        <View style={[styles.stageBadge, { backgroundColor: stageInfo.color + '22', borderColor: stageInfo.color + '55' }]}>
          <View style={[styles.stageDot, { backgroundColor: stageInfo.color }]} />
          <Text style={[styles.stageText, { color: stageInfo.color }]}>{stageInfo.label}</Text>
        </View>
        {lead.paid && (
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#10b981" />
            <Text style={styles.paidText}>Paid</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {/* Left panel */}
        <ScrollView style={styles.leftPanel} showsVerticalScrollIndicator={false}>
          {/* Info card */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.sectionTitle}>Lead Info</Text>
              <Pressable onPress={() => setEditMode(!editMode)} hitSlop={8}>
                <Ionicons name={editMode ? 'close' : 'pencil-outline'} size={16} color='#8a9bb0' />
              </Pressable>
            </View>
            {editMode ? (
              <>
                {(['name','phone','email','address'] as const).map(field => (
                  <View key={field} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={String(editData[field] || '')}
                      onChangeText={v => setEditData(prev => ({ ...prev, [field]: v }))}
                      placeholderTextColor='#506070'
                    />
                  </View>
                ))}
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Job Notes</Text>
                  <TextInput
                    style={[styles.fieldInput, { minHeight: 64, textAlignVertical: 'top' }]}
                    value={String(editData.jobNotes || '')}
                    onChangeText={v => setEditData(prev => ({ ...prev, jobNotes: v }))}
                    multiline
                    placeholderTextColor='#506070'
                  />
                </View>
                <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </>
            ) : (
              <>
                {[
                  { label: 'Phone', value: lead.phone },
                  { label: 'Email', value: lead.email },
                  { label: 'Address', value: lead.address },
                ].map(({ label, value }) => value ? (
                  <View key={label} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <Text style={styles.fieldValue}>{value}</Text>
                  </View>
                ) : null)}
                {lead.jobNotes ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    <Text style={styles.fieldValue}>{lead.jobNotes}</Text>
                  </View>
                ) : null}
                {bookedAt && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Demo booked</Text>
                    <Text style={[styles.fieldValue, { color: Colors.accent }]}>
                      {bookedAt.toLocaleDateString()} at {bookedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Stage mover */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Move Stage</Text>
            <View style={styles.stageRow}>
              {STAGES.map(s => (
                <Pressable
                  key={s.key}
                  style={[styles.stageBtn, lead.stage === s.key && { backgroundColor: s.color + '33', borderColor: s.color }]}
                  onPress={() => handleStageChange(s.key)}
                >
                  <Text style={[styles.stageBtnText, lead.stage === s.key && { color: s.color }]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <Pressable style={[styles.actionBtn, sendingIntro && styles.actionBtnDisabled]} onPress={handleSendIntro} disabled={sendingIntro}>
              {sendingIntro ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="send-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Send Intro SMS</Text>
                </>
              )}
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionBtnGreen, sendingPayment && styles.actionBtnDisabled]} onPress={handleSendPaymentLink} disabled={sendingPayment}>
              {sendingPayment ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="card-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Send Payment Link</Text>
                </>
              )}
            </Pressable>
            {lead.stripeSessionId && !lead.paid && (
              <Pressable style={[styles.actionBtn, styles.actionBtnYellow, verifyingPayment && styles.actionBtnDisabled]} onPress={() => handleVerifyPayment()} disabled={verifyingPayment}>
                {verifyingPayment ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Verify Payment</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>

        {/* Right panel — SMS thread */}
        <View style={styles.rightPanel}>
          <Text style={styles.sectionTitle} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f2f42', color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 16 } as any}>
            SMS Thread
          </Text>
          <ScrollView style={styles.messageList} ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
            {messages.length === 0 && (
              <View style={styles.emptyThread}>
                <Ionicons name="chatbubble-outline" size={32} color='#506070' />
                <Text style={styles.emptyThreadText}>No messages yet</Text>
                <Text style={styles.emptyThreadSub}>Send the intro SMS to start the conversation</Text>
              </View>
            )}
            {messages.map(msg => (
              <View key={msg.id} style={[styles.bubble, msg.direction === 'outbound' ? styles.bubbleOut : styles.bubbleIn]}>
                <Text style={[styles.bubbleText, msg.direction === 'outbound' ? styles.bubbleTextOut : styles.bubbleTextIn]}>
                  {msg.body}
                </Text>
                <Text style={styles.bubbleTime}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.smsCompose}>
            <TextInput
              style={styles.smsInput}
              value={smsBody}
              onChangeText={setSmsBody}
              placeholder="Type a message…"
              placeholderTextColor='#506070'
              multiline
              onSubmitEditing={handleSendSms}
            />
            <Pressable style={[styles.smsSendBtn, (!smsBody.trim() || sendingSms) && { opacity: 0.5 }]} onPress={handleSendSms} disabled={!smsBody.trim() || sendingSms}>
              {sendingSms ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1923' },
  errorText: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 16 },
  page: { flex: 1, backgroundColor: '#0f1923', paddingTop: Platform.OS === 'web' ? 67 : 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1f2f42',
  },
  headerName: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 18, flex: 1 },
  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stageText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#10b98120', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  paidText: { color: '#10b981', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  body: { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' },
  leftPanel: { width: Platform.OS === 'web' ? 340 : undefined, padding: 16 },
  rightPanel: {
    flex: 1,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderTopWidth: Platform.OS !== 'web' ? 1 : 0,
    borderColor: '#1f2f42',
    backgroundColor: '#0f1923',
  },
  infoCard: {
    backgroundColor: '#131e2c', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1f2f42', marginBottom: 12,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: '#e8edf4', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { color: '#506070', fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 4 },
  fieldValue: { color: '#e8edf4', fontFamily: 'Inter_400Regular', fontSize: 14 },
  fieldInput: {
    backgroundColor: '#0f1923', borderWidth: 1, borderColor: '#2a3a50', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, color: '#e8edf4',
    fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  stageBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#2a3a50', backgroundColor: '#0f1923',
  },
  stageBtnText: { color: '#8a9bb0', fontFamily: 'Inter_500Medium', fontSize: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 8,
  },
  actionBtnGreen: { backgroundColor: '#059669' },
  actionBtnYellow: { backgroundColor: '#d97706' },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  messageList: { flex: 1, padding: 16 },
  emptyThread: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyThreadText: { color: '#8a9bb0', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  emptyThreadSub: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  bubble: { maxWidth: '75%', marginBottom: 10, borderRadius: 14, padding: 12 },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleIn: { alignSelf: 'flex-start', backgroundColor: '#1a2535', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a3a50' },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  bubbleTextOut: { color: '#fff' },
  bubbleTextIn: { color: '#e8edf4' },
  bubbleTime: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4, textAlign: 'right' },
  smsCompose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: '#1f2f42',
    paddingBottom: Platform.OS === 'web' ? 34 : 12,
  },
  smsInput: {
    flex: 1, backgroundColor: '#131e2c', borderRadius: 12, borderWidth: 1, borderColor: '#2a3a50',
    paddingHorizontal: 14, paddingVertical: 10, color: '#e8edf4',
    fontFamily: 'Inter_400Regular', fontSize: 14, maxHeight: 120,
  },
  smsSendBtn: {
    backgroundColor: Colors.accent, borderRadius: 24, width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
});
