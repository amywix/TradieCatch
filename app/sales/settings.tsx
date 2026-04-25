import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOperatorAuth } from '@/lib/operator-auth';
import Colors from '@/constants/colors';

interface SalesSettings {
  demoVideoUrl: string;
  calendlyUrl: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  setupFeeAmount: number;
}

function Field({ label, value, onChange, placeholder, secureTextEntry, keyboardType, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  hint?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor='#506070'
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

export default function SalesSettingsScreen() {
  const { authFetch } = useOperatorAuth();
  const [settings, setSettings] = useState<SalesSettings>({
    demoVideoUrl: '',
    calendlyUrl: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    setupFeeAmount: 299,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await authFetch('api/sales/settings');
      const data = await res.json();
      if (data) setSettings({ ...settings, ...data });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await authFetch('api/sales/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const webhookBase = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://your-domain.replit.app';

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Demo Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demo Experience</Text>
          <Text style={styles.sectionDesc}>URLs sent automatically when leads reply DEMO or YES.</Text>
          <Field
            label="Demo Video URL"
            value={settings.demoVideoUrl}
            onChange={v => setSettings(s => ({ ...s, demoVideoUrl: v }))}
            placeholder="https://youtube.com/watch?v=..."
            hint="Sent when a lead texts DEMO"
          />
          <Field
            label="Calendly Booking URL"
            value={settings.calendlyUrl}
            onChange={v => setSettings(s => ({ ...s, calendlyUrl: v }))}
            placeholder="https://calendly.com/your-name/30min"
            hint="Sent when a lead texts YES to book their setup call"
          />
          <Field
            label="Setup Fee Amount (AUD)"
            value={String(settings.setupFeeAmount)}
            onChange={v => setSettings(s => ({ ...s, setupFeeAmount: Number(v) || 299 }))}
            placeholder="299"
            keyboardType="numeric"
          />
        </View>

        {/* Twilio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twilio (Sales SMS)</Text>
          <Text style={styles.sectionDesc}>
            Dedicated Twilio number for sending sales messages. Separate from your tradies' Twilio credentials.
          </Text>
          <Field
            label="Account SID"
            value={settings.twilioAccountSid}
            onChange={v => setSettings(s => ({ ...s, twilioAccountSid: v }))}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <Field
            label="Auth Token"
            value={settings.twilioAuthToken}
            onChange={v => setSettings(s => ({ ...s, twilioAuthToken: v }))}
            placeholder="••••••••••••••••••••"
            secureTextEntry
          />
          <Field
            label="Phone Number"
            value={settings.twilioPhoneNumber}
            onChange={v => setSettings(s => ({ ...s, twilioPhoneNumber: v }))}
            placeholder="+61400000000"
          />
        </View>

        {/* Webhook URLs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Webhook URLs</Text>
          <Text style={styles.sectionDesc}>Configure these in your external services.</Text>

          {[
            { label: 'Twilio SMS Webhook', url: `${webhookBase}/api/twilio/webhook`, hint: 'Set as "A MESSAGE COMES IN" webhook in Twilio console' },
            { label: 'Calendly Webhook', url: `${webhookBase}/api/sales/calendly-webhook`, hint: 'Add under Calendly → Integrations → Webhooks → invitee.created' },
          ].map(({ label, url, hint }) => (
            <View key={label} style={styles.webhookRow}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <View style={styles.webhookBox}>
                <Text style={styles.webhookUrl} selectable numberOfLines={1}>{url}</Text>
                {Platform.OS === 'web' && (
                  <Pressable
                    onPress={() => navigator.clipboard?.writeText(url)}
                    hitSlop={8}
                  >
                    <Ionicons name="copy-outline" size={16} color='#8a9bb0' />
                  </Pressable>
                )}
              </View>
              <Text style={styles.fieldHint}>{hint}</Text>
            </View>
          ))}
        </View>

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : saved
            ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Saved!</Text>
              </>
            )
            : <Text style={styles.saveBtnText}>Save Settings</Text>
          }
        </Pressable>
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
  content: { padding: 24, paddingBottom: 60, maxWidth: 720, width: '100%' },
  section: {
    backgroundColor: '#131e2c', borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: '#1f2f42', marginBottom: 20,
  },
  sectionTitle: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 6 },
  sectionDesc: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 18 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { color: '#8a9bb0', fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#0f1923', borderWidth: 1, borderColor: '#2a3a50', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, color: '#e8edf4',
    fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  fieldHint: { color: '#506070', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 },
  webhookRow: { marginBottom: 16 },
  webhookBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f1923', borderWidth: 1, borderColor: '#2a3a50', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  webhookUrl: { color: Colors.accent, fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
