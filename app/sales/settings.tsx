import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";

type SalesSettingsResp = {
  demoVideoUrl: string;
  calendlyUrl: string;
  introSmsTemplate: string;
  twilioPhoneNumber: string;
  webhookUrls: { twilioInboundSms: string; stripe: string; calendly: string };
  configuredSecrets: Record<string, boolean>;
};

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SalesSettingsResp>({ queryKey: ["/api/sales/settings"] });

  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [introSmsTemplate, setIntroSmsTemplate] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setDemoVideoUrl(data.demoVideoUrl || "");
      setCalendlyUrl(data.calendlyUrl || "");
      setIntroSmsTemplate(data.introSmsTemplate || "");
    }
  }, [data?.demoVideoUrl, data?.calendlyUrl, data?.introSmsTemplate]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/sales/settings", { demoVideoUrl, calendlyUrl, introSmsTemplate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/settings"] });
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  if (isLoading || !data) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  const copy = async (s: string) => {
    try { await Clipboard.setStringAsync(s); } catch {}
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auto-reply links</Text>
        <Text style={styles.help}>These are sent automatically to leads who reply DEMO or YES.</Text>

        <Text style={styles.label}>Demo video URL (sent on "DEMO" reply)</Text>
        <TextInput
          style={styles.input}
          value={demoVideoUrl}
          onChangeText={setDemoVideoUrl}
          placeholder="https://example.com/demo-video"
          autoCapitalize="none"
          placeholderTextColor={Colors.textTertiary}
          testID="settings-demo-url"
        />

        <Text style={styles.label}>Calendly URL (sent on "YES" reply)</Text>
        <TextInput
          style={styles.input}
          value={calendlyUrl}
          onChangeText={setCalendlyUrl}
          placeholder="https://calendly.com/your-account/demo"
          autoCapitalize="none"
          placeholderTextColor={Colors.textTertiary}
          testID="settings-calendly-url"
        />

        <Text style={styles.label}>Intro SMS template (use {"{{name}}"} for first name)</Text>
        <TextInput
          style={[styles.input, { height: 100 }]}
          value={introSmsTemplate}
          onChangeText={setIntroSmsTemplate}
          multiline
          placeholderTextColor={Colors.textTertiary}
          testID="settings-intro-sms"
        />

        <Pressable style={[styles.saveBtn, save.isPending && { opacity: 0.6 }]} onPress={() => save.mutate()} disabled={save.isPending} testID="settings-save">
          {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
        {savedAt && <Text style={styles.savedNote}>Saved at {savedAt}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Webhook URLs</Text>
        <Text style={styles.help}>Paste these URLs into each provider's webhook configuration.</Text>

        {[
          { label: "Twilio inbound SMS webhook", url: data.webhookUrls.twilioInboundSms, hint: "Paste into Twilio Console → Phone Numbers → Messaging → 'A MESSAGE COMES IN'" },
          { label: "Stripe webhook", url: data.webhookUrls.stripe, hint: "Stripe Dashboard → Developers → Webhooks (already configured by Replit Stripe sync)" },
          { label: "Calendly webhook", url: data.webhookUrls.calendly, hint: "Calendly Webhook Subscriptions API — events: invitee.created, invitee.canceled" },
        ].map(w => (
          <View key={w.label} style={styles.urlBlock}>
            <Text style={styles.urlLabel}>{w.label}</Text>
            <View style={styles.urlRow}>
              <TextInput style={styles.urlInput} value={w.url} editable={false} selectTextOnFocus />
              <Pressable style={styles.copyBtn} onPress={() => copy(w.url)}><Text style={styles.copyBtnText}>Copy</Text></Pressable>
            </View>
            <Text style={styles.urlHint}>{w.hint}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configured secrets</Text>
        <Text style={styles.help}>These environment variables are read by the server.</Text>
        <View style={{ gap: 6, marginTop: 8 }}>
          {Object.entries(data.configuredSecrets).map(([k, v]) => (
            <View key={k} style={styles.secretRow}>
              <Text style={styles.secretName}>{k}</Text>
              <View style={[styles.secretPill, v ? { backgroundColor: Colors.success } : { backgroundColor: Colors.danger }]}>
                <Text style={styles.secretPillText}>{v ? "SET" : "MISSING"}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.help}>Twilio outbound number: {data.twilioPhoneNumber || "(not set)"}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, gap: 16, maxWidth: 800, width: "100%", alignSelf: "center", paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  section: { backgroundColor: Colors.surface, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 4 },
  help: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 12 },
  label: { fontSize: 12, color: Colors.textSecondary, marginTop: 12, marginBottom: 6, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular" },
  saveBtn: { marginTop: 18, backgroundColor: Colors.accent, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  savedNote: { color: Colors.success, fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 8, textAlign: "center" },
  urlBlock: { marginTop: 14 },
  urlLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 6 },
  urlRow: { flexDirection: "row", gap: 8 },
  urlInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : "Inter_400Regular", color: Colors.text, backgroundColor: Colors.surfaceSecondary },
  copyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  copyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  urlHint: { fontSize: 11, color: Colors.textTertiary, fontFamily: "Inter_400Regular", marginTop: 6 },
  secretRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  secretName: { fontSize: 13, color: Colors.text, fontFamily: Platform.OS === "web" ? "monospace" : "Inter_500Medium" },
  secretPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  secretPillText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
});
