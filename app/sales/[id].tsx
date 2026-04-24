import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";

type Lead = {
  id: string; name: string; phoneNumber: string; email: string | null; address: string | null;
  jobNotes: string | null; stage: string; paid: boolean; paidAt: string | null;
  outcome: string | null; calendlyEventTime: string | null; calendlyEventUri: string | null;
  stripeCheckoutUrl: string | null; createdAt: string; updatedAt: string;
};
type Message = { id: string; leadId: string; direction: string; body: string; twilioSid: string | null; createdAt: string };
type LeadResp = { lead: Lead; messages: Message[] };

const STAGES = ["new", "qualified", "demo", "proposal", "closed"];

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function notify(msg: string) {
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert("", msg);
}

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<LeadResp>({ queryKey: [`/api/sales/leads/${id}`] });
  const lead = data?.lead;
  const messages = data?.messages || [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Lead>>({});
  const [reply, setReply] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);

  useEffect(() => { if (lead) setDraft({}); }, [lead?.id]);

  const saveLead = useMutation({
    mutationFn: async () => {
      const body: any = {};
      Object.entries(draft).forEach(([k, v]) => { if (v !== undefined) body[k] = v; });
      if (!Object.keys(body).length) return;
      await apiRequest("PATCH", `/api/sales/leads/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sales/leads/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      setEditing(false); setDraft({});
    },
  });

  const action = async (label: string, route: string, body?: any) => {
    setActionPending(label);
    try {
      const res = await apiRequest("POST", route, body || {});
      const data = await res.json().catch(() => ({}));
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      if (data?.url && Platform.OS === "web") {
        notify(`Sent! Stripe checkout link: ${data.url}`);
      } else {
        notify(`${label} sent`);
      }
    } catch (e: any) {
      notify(e?.message || `${label} failed`);
    } finally {
      setActionPending(null);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setActionPending("reply");
    try {
      await apiRequest("POST", `/api/sales/leads/${id}/send-message`, { body: reply.trim() });
      setReply("");
      await refetch();
    } catch (e: any) {
      notify(e?.message || "Failed");
    } finally {
      setActionPending(null);
    }
  };

  const closeLead = async (outcome: "won" | "lost") => {
    setActionPending(outcome);
    try {
      await apiRequest("PATCH", `/api/sales/leads/${id}`, { stage: "closed", outcome });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
    } finally { setActionPending(null); }
  };

  const removeLead = async () => {
    const ok = Platform.OS === "web" ? window.confirm("Delete this lead?") : true;
    if (!ok) return;
    await apiRequest("DELETE", `/api/sales/leads/${id}`);
    queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
    router.replace("/sales");
  };

  if (isLoading || !lead) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
        <Pressable onPress={removeLead} style={styles.deleteBtn}><Text style={styles.deleteBtnText}>Delete</Text></Pressable>
      </View>

      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <Text style={styles.h1}>{lead.name}</Text>
          {lead.paid && <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>PAID</Text></View>}
        </View>
        <Text style={styles.subdued}>{lead.phoneNumber}{lead.email ? ` · ${lead.email}` : ""}</Text>
        <Text style={[styles.subdued, { marginTop: 4 }]}>Stage: <Text style={{ color: Colors.text, fontFamily: "Inter_600SemiBold" }}>{lead.stage}</Text></Text>
        {lead.calendlyEventTime ? (
          <View style={[styles.bookedBlock, !lead.paid && styles.bookedBlockUnpaid]}>
            <Text style={styles.bookedLabel}>📅 Demo booked: {fmt(lead.calendlyEventTime)}</Text>
            {!lead.paid && <Text style={styles.bookedWarn}>⚠ Lead has NOT paid the $299 setup fee yet — do not take the call.</Text>}
          </View>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionBtn]} onPress={() => action("Intro SMS", `/api/sales/leads/${id}/send-intro`)} disabled={!!actionPending} testID="action-intro">
          <Text style={styles.actionBtnText}>{actionPending === "Intro SMS" ? "Sending..." : "Send intro SMS"}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnAlt]} onPress={() => action("Payment link", `/api/sales/leads/${id}/resend-payment`)} disabled={!!actionPending} testID="action-pay">
          <Text style={styles.actionBtnAltText}>Resend payment link</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnAlt]} onPress={() => action("Booking link", `/api/sales/leads/${id}/resend-booking`)} disabled={!!actionPending} testID="action-book">
          <Text style={styles.actionBtnAltText}>Resend booking link</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.btnGreen]} onPress={() => closeLead("won")} disabled={!!actionPending} testID="action-won">
          <Text style={styles.actionBtnText}>Mark won</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.btnRed]} onPress={() => closeLead("lost")} disabled={!!actionPending} testID="action-lost">
          <Text style={styles.actionBtnText}>Mark lost</Text>
        </Pressable>
      </View>

      <View style={styles.cols}>
        <View style={styles.col}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Lead details</Text>
              <Pressable onPress={() => setEditing(e => !e)}>
                <Text style={styles.linkText}>{editing ? "Cancel" : "Edit"}</Text>
              </Pressable>
            </View>
            <Field label="Name" editing={editing} value={(draft.name ?? lead.name) || ""} onChange={(v) => setDraft({ ...draft, name: v })} />
            <Field label="Phone" editing={editing} value={(draft.phoneNumber ?? lead.phoneNumber) || ""} onChange={(v) => setDraft({ ...draft, phoneNumber: v })} />
            <Field label="Email" editing={editing} value={(draft.email ?? lead.email) || ""} onChange={(v) => setDraft({ ...draft, email: v })} />
            <Field label="Address" editing={editing} value={(draft.address ?? lead.address) || ""} onChange={(v) => setDraft({ ...draft, address: v })} />
            <Field label="Stage" editing={editing} value={(draft.stage ?? lead.stage) || "new"} onChange={(v) => setDraft({ ...draft, stage: v })} options={STAGES} />
            <Field label="Job notes" editing={editing} multiline value={(draft.jobNotes ?? lead.jobNotes) || ""} onChange={(v) => setDraft({ ...draft, jobNotes: v })} />
            {editing && (
              <Pressable style={[styles.saveBtn, saveLead.isPending && { opacity: 0.6 }]} onPress={() => saveLead.mutate()} disabled={saveLead.isPending} testID="save-lead">
                {saveLead.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.col}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMS thread</Text>
            <View style={styles.thread}>
              {messages.length === 0 ? (
                <Text style={styles.threadEmpty}>No messages yet. Hit "Send intro SMS" to start the conversation.</Text>
              ) : messages.map(m => (
                <View key={m.id} style={[styles.bubbleRow, m.direction === "outbound" ? styles.bubbleRowOut : styles.bubbleRowIn]}>
                  <View style={[styles.bubble, m.direction === "outbound" ? styles.bubbleOut : styles.bubbleIn]}>
                    <Text style={[styles.bubbleText, m.direction === "outbound" && { color: "#fff" }]}>{m.body}</Text>
                    <Text style={[styles.bubbleTime, m.direction === "outbound" && { color: "rgba(255,255,255,0.7)" }]}>{fmt(m.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.replyRow}>
              <TextInput
                style={styles.replyInput}
                value={reply}
                onChangeText={setReply}
                placeholder="Type a reply..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                testID="reply-input"
              />
              <Pressable style={[styles.replyBtn, (!reply.trim() || actionPending === "reply") && { opacity: 0.5 }]} onPress={sendReply} disabled={!reply.trim() || actionPending === "reply"} testID="reply-send">
                {actionPending === "reply" ? <ActivityIndicator color="#fff" /> : <Text style={styles.replyBtnText}>Send</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, editing, onChange, multiline, options }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; multiline?: boolean; options?: string[] }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        options ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {options.map(o => (
              <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, value === o && styles.chipActive]}>
                <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <TextInput
            style={[styles.fieldInput, multiline && { height: 80 }]}
            value={value}
            onChangeText={onChange}
            multiline={!!multiline}
          />
        )
      ) : (
        <Text style={styles.fieldValue}>{value || "—"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { paddingVertical: 6 },
  backText: { color: Colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 14 },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.danger + "20" },
  deleteBtnText: { color: Colors.danger, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  headerCard: { backgroundColor: Colors.surface, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  subdued: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 4 },
  paidBadge: { backgroundColor: Colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  paidBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  bookedBlock: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: Colors.success + "15", borderLeftWidth: 3, borderLeftColor: Colors.success },
  bookedBlockUnpaid: { backgroundColor: Colors.danger + "15", borderLeftColor: Colors.danger },
  bookedLabel: { fontSize: 13, color: Colors.text, fontFamily: "Inter_600SemiBold" },
  bookedWarn: { fontSize: 12, color: Colors.danger, fontFamily: "Inter_700Bold", marginTop: 6 },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  actionBtnAlt: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.accent },
  actionBtnAltText: { color: Colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  btnGreen: { backgroundColor: Colors.success },
  btnRed: { backgroundColor: Colors.danger },
  cols: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 16 },
  col: { flex: 1 },
  section: { backgroundColor: Colors.surface, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 4 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  linkText: { color: Colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  field: { marginTop: 10 },
  fieldLabel: { fontSize: 11, color: Colors.textSecondary, fontFamily: "Inter_500Medium", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular" },
  fieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular" },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.accent },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_500Medium" },
  chipTextActive: { color: "#fff" },
  saveBtn: { marginTop: 14, backgroundColor: Colors.accent, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  thread: { gap: 10, paddingVertical: 12, maxHeight: 380, overflow: "scroll" as any },
  threadEmpty: { fontSize: 13, color: Colors.textTertiary, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 },
  bubbleRow: { flexDirection: "row" },
  bubbleRowOut: { justifyContent: "flex-end" },
  bubbleRowIn: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: 12 },
  bubbleOut: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleIn: { backgroundColor: Colors.surfaceSecondary, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 13, color: Colors.text, fontFamily: "Inter_400Regular" },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, fontFamily: "Inter_400Regular", marginTop: 4 },
  replyRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 12 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 44, fontFamily: "Inter_400Regular", color: Colors.text },
  replyBtn: { backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8 },
  replyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
