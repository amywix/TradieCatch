import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";

type Lead = { id: string; name: string; phoneNumber: string; paid: boolean; calendlyEventTime: string | null; stage: string };

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AgendaScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery<Lead[]>({ queryKey: ["/api/sales/agenda"] });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Upcoming demos</Text>
      {(data || []).length === 0 ? (
        <Text style={styles.empty}>No demos booked yet. When leads pick a time on Calendly, they'll appear here.</Text>
      ) : (
        (data || []).map(lead => (
          <Pressable
            key={lead.id}
            style={[styles.card, !lead.paid && styles.cardUnpaid]}
            onPress={() => router.push(`/sales/${lead.id}` as any)}
            testID={`agenda-row-${lead.id}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{lead.name}</Text>
              <Text style={styles.phone}>{lead.phoneNumber}</Text>
              <Text style={styles.time}>{fmt(lead.calendlyEventTime)}</Text>
            </View>
            {lead.paid ? (
              <View style={[styles.pill, { backgroundColor: Colors.success }]}><Text style={styles.pillText}>PAID</Text></View>
            ) : (
              <View style={[styles.pill, { backgroundColor: Colors.danger }]}><Text style={styles.pillText}>UNPAID</Text></View>
            )}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, gap: 12, maxWidth: 800, width: "100%", alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  empty: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 24, textAlign: "center" },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", borderLeftWidth: 4, borderLeftColor: Colors.success, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  cardUnpaid: { borderLeftColor: Colors.danger, backgroundColor: Colors.danger + "08" },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  phone: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  time: { fontSize: 13, color: Colors.text, fontFamily: "Inter_500Medium", marginTop: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
});
