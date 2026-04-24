import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

export default function SalesLoginScreen() {
  const router = useRouter();
  const { login, user, token, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("operator@tradiecatch.com");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !token) return;
    (async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/sales/leads`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) router.replace("/sales");
      } catch {}
    })();
  }, [user, token, authLoading]);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/sales");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.h1}>TradieCatch Sales</Text>
        <Text style={styles.subtitle}>Operator login</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="operator@tradiecatch.com"
          placeholderTextColor={Colors.textTertiary}
          testID="sales-login-email"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={Colors.textTertiary}
          testID="sales-login-password"
        />

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <Pressable
          style={[styles.btn, submitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={submitting}
          testID="sales-login-submit"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign in</Text>}
        </Pressable>

        <Text style={styles.hint}>
          Use the operator credentials provided by your administrator.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: Platform.OS === "web" ? "100vh" as any : "100%" as any,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    paddingTop: Platform.OS === "web" ? 80 : 100,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  h1: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginTop: 4, marginBottom: 24, fontFamily: "Inter_400Regular" },
  label: { fontSize: 13, color: Colors.textSecondary, marginTop: 12, marginBottom: 6, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: Colors.surface, color: Colors.text, fontFamily: "Inter_400Regular",
  },
  btn: {
    marginTop: 20, backgroundColor: Colors.accent, paddingVertical: 14,
    borderRadius: 10, alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  err: { color: Colors.danger, marginTop: 12, fontSize: 13, fontFamily: "Inter_500Medium" },
  hint: { color: Colors.textTertiary, fontSize: 11, marginTop: 16, textAlign: "center", fontFamily: "Inter_400Regular" },
});
