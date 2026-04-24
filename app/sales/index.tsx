import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";

const STAGES = [
  { key: "new", label: "New" },
  { key: "qualified", label: "Qualified" },
  { key: "demo", label: "Demo" },
  { key: "proposal", label: "Proposal" },
  { key: "closed", label: "Closed" },
];

type Lead = {
  id: string; name: string; phoneNumber: string; email: string | null; address: string | null;
  jobNotes: string | null; stage: string; paid: boolean; paidAt: string | null;
  outcome: string | null; calendlyEventTime: string | null; calendlyEventUri: string | null;
  stripeCheckoutUrl: string | null; createdAt: string; updatedAt: string;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PipelineBoard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: leadsData, isLoading } = useQuery<Lead[]>({ queryKey: ["/api/sales/leads"] });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await apiRequest("PATCH", `/api/sales/leads/${id}`, { stage });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] }),
  });

  const grouped = useMemo(() => {
    const g: Record<string, Lead[]> = { new: [], qualified: [], demo: [], proposal: [], closed: [] };
    (leadsData || []).forEach(l => {
      const s = STAGES.find(x => x.key === l.stage)?.key || "new";
      g[s].push(l);
    });
    return g;
  }, [leadsData]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Pipeline</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)} testID="add-lead-btn">
          <Text style={styles.addBtnText}>+ Add lead</Text>
        </Pressable>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.boardScroll} showsHorizontalScrollIndicator={false}>
        {STAGES.map(stage => (
          <View key={stage.key} style={styles.column} testID={`column-${stage.key}`}>
            <View style={styles.colHeader}>
              <Text style={styles.colTitle}>{stage.label}</Text>
              <Text style={styles.colCount}>{grouped[stage.key].length}</Text>
            </View>
            <ScrollView style={{ maxHeight: 700 }} contentContainerStyle={{ gap: 10 }}>
              {grouped[stage.key].length === 0 ? (
                <Text style={styles.emptyCol}>No leads yet</Text>
              ) : (
                grouped[stage.key].map(lead => (
                  <Pressable
                    key={lead.id}
                    style={styles.card}
                    onPress={() => router.push(`/sales/${lead.id}` as any)}
                    testID={`lead-card-${lead.id}`}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardName} numberOfLines={1}>{lead.name}</Text>
                      {lead.paid && <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>PAID</Text></View>}
                    </View>
                    <Text style={styles.cardPhone}>{lead.phoneNumber}</Text>
                    {lead.calendlyEventTime ? (
                      <View style={styles.bookedRow}>
                        <Text style={styles.bookedLabel}>📅 {formatDateTime(lead.calendlyEventTime)}</Text>
                        {!lead.paid && (
                          <Text style={styles.unpaidWarn}>⚠ Unpaid</Text>
                        )}
                      </View>
                    ) : null}
                    {lead.outcome && <Text style={styles.outcome}>{lead.outcome.toUpperCase()}</Text>}
                    <View style={styles.stagePicker}>
                      {STAGES.map(s => (
                        <Pressable
                          key={s.key}
                          onPress={(e: any) => { e.stopPropagation?.(); updateStage.mutate({ id: lead.id, stage: s.key }); }}
                          style={[styles.stageOpt, lead.stage === s.key && styles.stageOptActive]}
                        >
                          <Text style={[styles.stageOptText, lead.stage === s.key && styles.stageOptTextActive]}>{s.label[0]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <AddLeadModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

function AddLeadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [jobNotes, setJobNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setName(""); setPhoneNumber(""); setEmail(""); setAddress(""); setJobNotes(""); };

  const onSubmit = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      if (Platform.OS === "web") window.alert("Name and phone number are required");
      else Alert.alert("Missing fields", "Name and phone number are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/sales/leads", { name, phoneNumber, email, address, jobNotes });
      await queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      reset();
      onClose();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e?.message || "Failed");
      else Alert.alert("Error", e?.message || "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>Add lead</Text>

          <Text style={modalStyles.label}>Name *</Text>
          <TextInput style={modalStyles.input} value={name} onChangeText={setName} placeholder="Sam Smith" placeholderTextColor={Colors.textTertiary} testID="add-lead-name" />

          <Text style={modalStyles.label}>Phone number *</Text>
          <TextInput style={modalStyles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+61400000000" keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} testID="add-lead-phone" />

          <Text style={modalStyles.label}>Email</Text>
          <TextInput style={modalStyles.input} value={email} onChangeText={setEmail} placeholder="sam@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.textTertiary} testID="add-lead-email" />

          <Text style={modalStyles.label}>Address</Text>
          <TextInput style={modalStyles.input} value={address} onChangeText={setAddress} placeholder="123 Some St, Suburb" placeholderTextColor={Colors.textTertiary} />

          <Text style={modalStyles.label}>Job notes</Text>
          <TextInput style={[modalStyles.input, { height: 80 }]} value={jobNotes} onChangeText={setJobNotes} placeholder="What we know about this lead" multiline placeholderTextColor={Colors.textTertiary} />

          <View style={modalStyles.row}>
            <Pressable style={[modalStyles.btn, modalStyles.btnGhost]} onPress={onClose}>
              <Text style={modalStyles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable style={[modalStyles.btn, modalStyles.btnPrimary, submitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={submitting} testID="add-lead-submit">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.btnPrimaryText}>Add lead</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  boardScroll: { gap: 12, paddingBottom: 40 },
  column: { width: 280, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12 },
  colHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  colTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  colCount: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary, backgroundColor: Colors.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  emptyCol: { fontSize: 12, color: Colors.textTertiary, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.borderLight },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text, flex: 1 },
  cardPhone: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  paidBadge: { backgroundColor: Colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paidBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  bookedRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 4 },
  bookedLabel: { fontSize: 11, color: Colors.text, fontFamily: "Inter_500Medium" },
  unpaidWarn: { fontSize: 11, color: Colors.danger, fontFamily: "Inter_700Bold" },
  outcome: { fontSize: 10, color: Colors.textSecondary, fontFamily: "Inter_700Bold", marginTop: 6, letterSpacing: 0.5 },
  stagePicker: { flexDirection: "row", marginTop: 8, gap: 4 },
  stageOpt: { flex: 1, paddingVertical: 4, borderRadius: 4, backgroundColor: Colors.surfaceSecondary, alignItems: "center" },
  stageOptActive: { backgroundColor: Colors.accent },
  stageOptText: { fontSize: 10, color: Colors.textSecondary, fontFamily: "Inter_700Bold" },
  stageOptTextActive: { color: "#fff" },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 24, width: "100%", maxWidth: 460 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12 },
  label: { fontSize: 12, color: Colors.textSecondary, marginTop: 10, marginBottom: 4, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  btnPrimary: { backgroundColor: Colors.accent },
  btnPrimaryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
