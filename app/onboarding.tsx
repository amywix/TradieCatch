import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, Dimensions, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';

const { width } = Dimensions.get('window');

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.stepContainer}>
      <View style={styles.welcomeIconContainer}>
        <View style={styles.welcomeIconBg}>
          <Ionicons name="flash" size={56} color={Colors.accent} />
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <Text style={styles.welcomeTitle}>Welcome to{'\n'}TradieCatch</Text>
        <Text style={styles.welcomeSubtitle}>
          Never lose a customer from a missed call again. Auto-reply with SMS and book jobs on the spot.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.featureList}>
        <FeatureItem
          icon="chatbubbles-outline"
          title="Auto SMS Replies"
          desc="Missed a call? We'll text them back automatically"
        />
        <FeatureItem
          icon="construct-outline"
          title="Smart Job Booking"
          desc="Customers book through a guided SMS conversation"
        />
        <FeatureItem
          icon="calendar-outline"
          title="Job Management"
          desc="Track and manage all your jobs in one place"
        />
      </Animated.View>

      <View style={styles.bottomAction}>
        <Pressable style={styles.primaryBtn} onPress={onNext}>
          <Text style={styles.primaryBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={22} color={Colors.accent} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function BusinessStep({ businessName, setBusinessName, onNext, onBack }: {
  businessName: string;
  setBusinessName: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContainer}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </Pressable>

      <View style={styles.stepIconContainer}>
        <View style={[styles.stepIconBg, { backgroundColor: '#E8EEF8' }]}>
          <Ionicons name="business-outline" size={36} color={Colors.primaryLight} />
        </View>
      </View>

      <Text style={styles.stepTitle}>Your Business</Text>
      <Text style={styles.stepSubtitle}>
        This name will be used in your automated SMS messages to customers.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Name</Text>
        <TextInput
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="e.g. Dave's Electrical Services"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />
      </View>

      <View style={styles.bottomAction}>
        <Pressable
          style={[styles.primaryBtn, !businessName.trim() && styles.primaryBtnDisabled]}
          onPress={onNext}
          disabled={!businessName.trim()}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function TwilioStep({ sid, setSid, token, setToken, phone, setPhone, onNext, onBack, saving }: {
  sid: string; setSid: (v: string) => void;
  token: string; setToken: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  onNext: () => void; onBack: () => void;
  saving: boolean;
}) {
  const isValid = sid.trim().length > 10 && token.trim().length > 10 && phone.trim().length > 5;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContainer}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.stepIconContainer}>
          <View style={[styles.stepIconBg, { backgroundColor: '#E8F8ED' }]}>
            <MaterialCommunityIcons name="message-text-outline" size={36} color={Colors.success} />
          </View>
        </View>

        <Text style={styles.stepTitle}>Connect Twilio</Text>
        <Text style={styles.stepSubtitle}>
          Twilio sends and receives SMS messages on your behalf. You'll need a Twilio account to use TradieCatch.
        </Text>

        <View style={styles.helpCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primaryLight} />
          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>How to get Twilio credentials:</Text>
            <Text style={styles.helpText}>1. Go to twilio.com and sign up (free trial available)</Text>
            <Text style={styles.helpText}>2. Get a phone number in your Console</Text>
            <Text style={styles.helpText}>3. Copy your Account SID and Auth Token from the dashboard</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Account SID</Text>
          <TextInput
            style={styles.input}
            value={sid}
            onChangeText={setSid}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Auth Token</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="Your auth token"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Twilio Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1234567890"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
          />
          <Text style={styles.inputHint}>Include country code (e.g. +61 for Australia)</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomAction}>
        <Pressable
          style={[styles.primaryBtn, (!isValid || saving) && styles.primaryBtnDisabled]}
          onPress={onNext}
          disabled={!isValid || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>Finish Setup</Text>
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.stepContainer}>
      <View style={styles.doneIconContainer}>
        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          <View style={styles.doneIconBg}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(300).duration(500)}>
        <Text style={styles.doneTitle}>You're All Set!</Text>
        <Text style={styles.doneSubtitle}>
          TradieCatch is ready to catch your missed calls and turn them into booked jobs.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.doneChecklist}>
        <View style={styles.doneCheckItem}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          <Text style={styles.doneCheckText}>Business profile set up</Text>
        </View>
        <View style={styles.doneCheckItem}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          <Text style={styles.doneCheckText}>Twilio SMS connected</Text>
        </View>
        <View style={styles.doneCheckItem}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          <Text style={styles.doneCheckText}>Auto-reply ready to go</Text>
        </View>
      </Animated.View>

      <View style={styles.webhookReminder}>
        <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
        <Text style={styles.webhookReminderText}>
          Don't forget to set your Twilio incoming SMS webhook URL in the Twilio console. You can find it in Settings.
        </Text>
      </View>

      <View style={styles.bottomAction}>
        <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.success }]} onPress={onFinish}>
          <Text style={styles.primaryBtnText}>Start Catching Calls</Text>
          <Ionicons name="flash" size={20} color={Colors.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { updateAppSettings } = useData();
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState('');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioPhone, setTwilioPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleFinishTwilio = useCallback(async () => {
    setSaving(true);
    try {
      await updateAppSettings({
        businessName: businessName.trim(),
        twilioAccountSid: twilioSid.trim(),
        twilioAuthToken: twilioToken.trim(),
        twilioPhoneNumber: twilioPhone.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(3);
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [businessName, twilioSid, twilioToken, twilioPhone, updateAppSettings]);

  const handleComplete = useCallback(async () => {
    await updateAppSettings({ onboardingComplete: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/');
  }, [updateAppSettings]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.inner, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 20 }]}>
        {step < 3 && (
          <View style={styles.progressRow}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
        )}

        {step === 0 && <WelcomeStep onNext={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(1); }} />}
        {step === 1 && (
          <BusinessStep
            businessName={businessName}
            setBusinessName={setBusinessName}
            onNext={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(2); }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <TwilioStep
            sid={twilioSid} setSid={setTwilioSid}
            token={twilioToken} setToken={setTwilioToken}
            phone={twilioPhone} setPhone={setTwilioPhone}
            onNext={handleFinishTwilio}
            onBack={() => setStep(1)}
            saving={saving}
          />
        )}
        {step === 3 && <DoneStep onFinish={handleComplete} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.accent,
    width: 24,
  },
  stepContainer: {
    flex: 1,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  welcomeIconContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  welcomeIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 40,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 12,
  },
  featureList: {
    marginTop: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stepIconContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  stepIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  helpCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E8EEF8',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    marginBottom: 8,
  },
  helpTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  inputGroup: {
    marginTop: 16,
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    paddingLeft: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    paddingLeft: 4,
  },
  bottomAction: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 50 : 40,
    left: 0,
    right: 0,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  doneIconContainer: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  doneIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  doneChecklist: {
    marginTop: 28,
    gap: 14,
  },
  doneCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneCheckText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  webhookReminder: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFF8E0',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    alignItems: 'flex-start',
  },
  webhookReminderText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
