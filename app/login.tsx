import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, Alert,
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

type Screen = 'landing' | 'register' | 'login';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [screen, setScreen] = useState<Screen>('landing');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Missing Info', 'Please enter a business name.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      await register(email.trim(), username.trim(), password);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (screen === 'register') setScreen('landing');
    else if (screen === 'login') setScreen('landing');
  };

  if (screen === 'landing') {
    return (
      <View style={[styles.landing, { paddingTop: topInset + 20, paddingBottom: bottomInset + 20 }]}>
        <Animated.View entering={FadeIn.duration(700)} style={styles.landingHero}>
          <View style={styles.logoBg}>
            <Ionicons name="flash" size={56} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>TradieCatch</Text>
          <Text style={styles.tagline}>Never miss a customer again</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.landingFeatures}>
          <LandingFeature icon="chatbubbles-outline" text="Auto SMS replies to missed calls" />
          <LandingFeature icon="construct-outline" text="Customers book jobs via SMS" />
          <LandingFeature icon="calendar-outline" text="Manage all your jobs in one place" />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.landingActions}>
          <Pressable
            style={styles.trialBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setScreen('register');
            }}
            testID="trial-btn"
          >
            <Ionicons name="flash" size={20} color={Colors.white} />
            <Text style={styles.trialBtnText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={styles.loginBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setScreen('login');
            }}
            testID="login-btn"
          >
            <Text style={styles.loginBtnText}>Already have an account? Sign In</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.formScreen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 16, paddingBottom: bottomInset + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>

        <Animated.View entering={FadeIn.duration(400)} style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.formLogoBg}>
              <Ionicons name="flash" size={28} color={Colors.accent} />
            </View>
            <Text style={styles.formTitle}>
              {screen === 'register' ? 'Create Your Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.formSubtitle}>
              {screen === 'register'
                ? 'Sign up to get started'
                : 'Sign in to your TradieCatch account'}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="email-input"
              />
            </View>
          </View>

          {screen === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="business-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. Dave's Electrical"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="words"
                  testID="username-input"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry={!showPassword}
                testID="password-input"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {screen === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPassword}
                  testID="confirm-password-input"
                />
              </View>
            </View>
          )}

          <Pressable
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={screen === 'register' ? handleRegister : handleLogin}
            disabled={isSubmitting}
            testID="submit-btn"
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                {screen === 'register' ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.switchBtn}
            onPress={() => {
              setPassword('');
              setConfirmPassword('');
              setScreen(screen === 'register' ? 'login' : 'register');
            }}
            testID="switch-auth-btn"
          >
            <Text style={styles.switchText}>
              {screen === 'register' ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextBold}>{screen === 'register' ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LandingFeature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.landingFeatureRow}>
      <View style={styles.landingFeatureIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.accent} />
      </View>
      <Text style={styles.landingFeatureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  landing: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  landingHero: {
    alignItems: 'center',
    paddingTop: 20,
  },
  logoBg: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
  },
  landingFeatures: {
    gap: 12,
    paddingHorizontal: 8,
  },
  landingFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  landingFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingFeatureText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.8)',
  },
  landingActions: {
    gap: 12,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  trialBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.accent,
  },
  trialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
  },
  trialBtnText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  loginBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  loginBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.7)',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  formScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  formLogoBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  eyeBtn: {
    padding: 8,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  switchBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  switchTextBold: {
    fontFamily: 'Inter_700Bold',
    color: Colors.accent,
  },
});
