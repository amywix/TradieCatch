import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

export default function SalesLoginScreen() {
  const router = useRouter();
  const { login, logout, user, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in as operator, jump straight to the board
  useEffect(() => {
    if (isAuthenticated && user?.isOperator) {
      router.replace('/sales');
    }
  }, [isAuthenticated, user?.isOperator]);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Enter email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // After login, useAuth().user will reflect the new account. Read it via state on next render
      // — but for an immediate decision, re-fetch /me.
      const { fetch } = await import('expo/fetch');
      const { getApiUrl } = await import('@/lib/query-client');
      const { getAuthToken } = await import('@/lib/auth-context');
      const token = getAuthToken();
      const res = await fetch(`${getApiUrl()}api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await res.json();
      if (!me?.isOperator) {
        await logout();
        throw new Error('This account is not authorised for the sales portal.');
      }
      router.replace('/sales');
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoBg}>
            <Ionicons name="briefcase" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.title}>TradieCatch Sales</Text>
          <Text style={styles.subtitle}>Operator portal</Text>
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@company.com"
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

        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting}
          testID="sales-login-submit"
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Sign In</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} style={{ marginTop: 16 }}>
          <Text style={styles.linkText}>Tradie? Sign in here →</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.surface, borderRadius: 16, padding: 28 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoBg: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 4 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, color: Colors.text, fontFamily: 'Inter_400Regular',
  },
  submitBtn: {
    marginTop: 20, backgroundColor: Colors.accent, paddingVertical: 14,
    borderRadius: 10, alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  linkText: { color: Colors.accent, textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 14 },
});
