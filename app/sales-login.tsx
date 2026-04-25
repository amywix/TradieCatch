import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useOperatorAuth } from '@/lib/operator-auth';
import Colors from '@/constants/colors';

export default function SalesLogin() {
  const { login, isAuthenticated, isLoading, error } = useOperatorAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/sales' as any);
    }
  }, [isAuthenticated, isLoading]);

  const handleLogin = async () => {
    setLocalError(null);
    if (!email.trim() || !password) { setLocalError('Email and password are required'); return; }
    setSubmitting(true);
    const ok = await login(email.trim(), password);
    setSubmitting(false);
    if (ok) router.replace('/sales' as any);
    else setLocalError(error || 'Login failed');
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>TC</Text>
          </View>
          <Text style={styles.brandName}>TradieCatch</Text>
        </View>
        <Text style={styles.title}>Operator Portal</Text>
        <Text style={styles.subtitle}>Sign in to manage the sales pipeline</Text>

        {(localError || error) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{localError || error}</Text>
          </View>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="operator@tradiecatch.com"
          placeholderTextColor='#506070'
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor='#506070'
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={handleLogin}
        />

        <Pressable
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1923' },
  page: {
    flex: 1,
    backgroundColor: '#0f1923',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'web' ? 67 : 0,
    paddingBottom: Platform.OS === 'web' ? 34 : 0,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a2535',
    borderRadius: 16,
    padding: 36,
    borderWidth: 1,
    borderColor: '#2a3a50',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, gap: 12 },
  logoBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  brandName: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 20 },
  title: { color: '#e8edf4', fontFamily: 'Inter_700Bold', fontSize: 26, marginBottom: 6 },
  subtitle: { color: '#8a9bb0', fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 28 },
  errorBox: {
    backgroundColor: '#3d1a1a', borderRadius: 8, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#7c2b2b',
  },
  errorText: { color: '#f87171', fontFamily: 'Inter_400Regular', fontSize: 13 },
  label: { color: '#8a9bb0', fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#0f1923',
    borderWidth: 1,
    borderColor: '#2a3a50',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e8edf4',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
