import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { apiRequest, queryClient } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface SalesSettingsResp {
  id: string;
  demoVideoUrl: string | null;
  calendlyUrl: string | null;
  setupFeeAmountCents: number;
  setupFeeProductName: string;
  webhooks: { calendly: string; twilioInbound: string; stripe: string };
}

export default function SalesSettings() {
  const { data, isLoading, refetch } = useQuery<SalesSettingsResp>({
    queryKey: ['/api/sales/settings'],
  });

  const [demoVideoUrl, setDemoVideoUrl] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [feeDollars, setFeeDollars] = useState('299');
  const [productName, setProductName] = useState('TradieCatch Setup Fee');

  useEffect(() => {
    if (data) {
      setDemoVideoUrl(data.demoVideoUrl || '');
      setCalendlyUrl(data.calendlyUrl || '');
      setFeeDollars(String(Math.round((data.setupFeeAmountCents || 0) / 100)));
      setProductName(data.setupFeeProductName || 'TradieCatch Setup Fee');
    }
  }, [data?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const cents = Math.max(50, Math.round(parseFloat(feeDollars || '0') * 100));
      const res = await apiRequest('PATCH', '/api/sales/settings', {
        demoVideoUrl,
        calendlyUrl,
        setupFeeAmountCents: cents,
        setupFeeProductName: productName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/settings'] });
      Alert.alert('Saved', 'Sales settings updated.');
    },
    onError: (e: any) => Alert.alert('Error', e?.message || 'Failed to save'),
  });

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    if (Platform.OS === 'web') {
      // Some browsers need an extra hint
    }
    Alert.alert('Copied', 'Copied to clipboard.');
  };

  if (isLoading || !data) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Sales Settings</Text>

      <Section title="Auto-reply Content">
        <Field
          label="Demo video URL"
          value={demoVideoUrl}
          onChangeText={setDemoVideoUrl}
          placeholder="https://youtu.be/..."
          help="Sent when a lead replies DEMO."
        />
        <Field
          label="Calendly link"
          value={calendlyUrl}
          onChangeText={setCalendlyUrl}
          placeholder="https://calendly.com/your-handle/setup"
          help="Sent when a lead replies YES."
        />
      </Section>

      <Section title="Setup Fee">
        <Field
          label="Amount (AUD)"
          value={feeDollars}
          onChangeText={setFeeDollars}
          keyboardType="numeric"
          help="Charged via Stripe Checkout when you press 'Create Checkout' or when the lead replies YES."
        />
        <Field
          label="Product name on receipt"
          value={productName}
          onChangeText={setProductName}
        />
      </Section>

      <Pressable
        style={[styles.saveBtn, save.isPending && { opacity: 0.6 }]}
        onPress={() => save.mutate()}
        disabled={save.isPending}
        testID="save-sales-settings"
      >
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
      </Pressable>

      <Section title="Webhook URLs">
        <Text style={styles.help}>Paste these into the matching service so events flow back to the app.</Text>
        <WebhookRow label="Calendly (invitee.created)" url={data.webhooks.calendly} onCopy={() => copy(data.webhooks.calendly)} />
        <WebhookRow label="Twilio inbound SMS" url={data.webhooks.twilioInbound} onCopy={() => copy(data.webhooks.twilioInbound)} />
        <WebhookRow label="Stripe (managed)" url={data.webhooks.stripe} onCopy={() => copy(data.webhooks.stripe)} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, help, ...rest }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholderTextColor={Colors.textTertiary}
        {...rest}
      />
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

function WebhookRow({ label, url, onCopy }: { label: string; url: string; onCopy: () => void }) {
  return (
    <View style={styles.webhookRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.webhookLabel}>{label}</Text>
        <Text style={styles.webhookUrl} selectable>{url}</Text>
      </View>
      <Pressable onPress={onCopy} style={styles.copyBtn} testID={`copy-${label}`}>
        <Ionicons name="copy-outline" size={14} color={Colors.text} />
        <Text style={styles.copyText}>Copy</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20, gap: 16, maxWidth: 760 },
  h1: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text },
  section: { backgroundColor: Colors.surface, borderRadius: 10, padding: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 4 },
  fieldInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: 'Inter_400Regular' },
  help: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, marginTop: 4 },
  saveBtn: { backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  webhookRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  webhookLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.text },
  webhookUrl: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  copyText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text },
});
