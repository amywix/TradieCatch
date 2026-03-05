import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';

const STEPS = ['Get Twilio', 'Connect', 'Business'];

function ProgressBar({ current }: { current: number }) {
  return (
    <View style={pb.container}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <View style={pb.stepCol}>
              <View style={[pb.circle, done && pb.circleDone, active && pb.circleActive]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={[pb.circleNum, active && pb.circleNumActive]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[pb.label, (done || active) && pb.labelActive]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[pb.line, done && pb.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const pb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  stepCol: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: Colors.accent,
  },
  circleDone: {
    backgroundColor: Colors.success,
  },
  circleNum: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textTertiary,
  },
  circleNumActive: {
    color: '#fff',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginTop: 15,
    marginHorizontal: 2,
  },
  lineDone: {
    backgroundColor: Colors.success,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.text,
  },
});

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
        <FeatureItem icon="chatbubbles-outline" title="Auto SMS Replies" desc="Missed a call? We'll text them back automatically" />
        <FeatureItem icon="construct-outline" title="Smart Job Booking" desc="Customers book through a guided SMS conversation" />
        <FeatureItem icon="calendar-outline" title="Job Management" desc="Track and manage all your jobs in one place" />
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

function GetTwilioStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContainer}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </Pressable>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.stepIconContainer}>
          <View style={[styles.stepIconBg, { backgroundColor: '#FFF0E8' }]}>
            <Ionicons name="call-outline" size={36} color={Colors.accent} />
          </View>
        </View>
        <Text style={styles.stepTitle}>Get a Twilio Number</Text>
        <Text style={styles.stepSubtitle}>
          Twilio is the phone service TradieCatch uses to send and receive SMS messages for you. You'll need a Twilio account and phone number to continue.
        </Text>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsCardTitle}>How to get set up (5 minutes)</Text>
          <StepRow num={1} text="Go to twilio.com and create a free account" />
          <StepRow num={2} text='From the Console, click "Get a phone number"' />
          <StepRow num={3} text="Choose a number in your country" />
          <StepRow num={4} text="Note down your Account SID, Auth Token, and the phone number" />
        </View>

        <Pressable
          style={styles.externalLink}
          onPress={() => Linking.openURL('https://www.twilio.com/try-twilio')}
        >
          <Ionicons name="globe-outline" size={18} color={Colors.primaryLight} />
          <Text style={styles.externalLinkText}>Open Twilio sign-up page</Text>
          <Ionicons name="open-outline" size={16} color={Colors.primaryLight} />
        </Pressable>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.infoBoxText}>
            Twilio offers a free trial with credit. For production use, Australian numbers cost approximately $1.15 USD/month plus usage.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.bottomAction}>
        <Pressable style={styles.primaryBtn} onPress={onNext}>
          <Text style={styles.primaryBtnText}>I have a Twilio number</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function StepRow({ num, text }: { num: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRowNum}>
        <Text style={styles.stepRowNumText}>{num}</Text>
      </View>
      <Text style={styles.stepRowText}>{text}</Text>
    </View>
  );
}

function ConnectTwilioStep({ sid, setSid, token, setToken, phone, setPhone, onNext, onBack, saving }: {
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
            <Ionicons name="key-outline" size={36} color={Colors.success} />
          </View>
        </View>
        <Text style={styles.stepTitle}>Connect Twilio</Text>
        <Text style={styles.stepSubtitle}>
          Enter your Twilio credentials from the Twilio Console dashboard.
        </Text>
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
            placeholder="+61412345678"
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
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

function BusinessStep({ businessName, setBusinessName, onNext, onBack, saving }: {
  businessName: string;
  setBusinessName: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
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
        This name will appear in your automated SMS messages to customers.
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
          style={[styles.primaryBtn, (!businessName.trim() || saving) && styles.primaryBtnDisabled]}
          onPress={onNext}
          disabled={!businessName.trim() || saving}
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
        <DoneItem text="Twilio number connected" />
        <DoneItem text="Business profile set up" />
        <DoneItem text="Auto-reply ready to go" />
      </Animated.View>
      <View style={styles.webhookReminder}>
        <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
        <Text style={styles.webhookReminderText}>
          Set your Twilio incoming SMS webhook URL in the Twilio console. You can find the URL in Settings.
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

function DoneItem({ text }: { text: string }) {
  return (
    <View style={styles.doneCheckItem}>
      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
      <Text style={styles.doneCheckText}>{text}</Text>
    </View>
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

  const progressStep = step >= 1 && step <= 3 ? step - 1 : null;

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      await updateAppSettings({
        businessName: businessName.trim(),
        twilioAccountSid: twilioSid.trim(),
        twilioAuthToken: twilioToken.trim(),
        twilioPhoneNumber: twilioPhone.trim(),
        onboardingComplete: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(4);
    } catch {
      setSaving(false);
    }
  }, [businessName, twilioSid, twilioToken, twilioPhone, updateAppSettings]);

  const handleComplete = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/');
  }, []);

  const advance = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(next);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.inner, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 20, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom }]}>
        {progressStep !== null && <ProgressBar current={progressStep} />}

        {step === 0 && <WelcomeStep onNext={() => advance(1)} />}
        {step === 1 && (
          <GetTwilioStep
            onNext={() => advance(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <ConnectTwilioStep
            sid={twilioSid} setSid={setTwilioSid}
            token={twilioToken} setToken={setTwilioToken}
            phone={twilioPhone} setPhone={setTwilioPhone}
            onNext={() => advance(3)}
            onBack={() => setStep(1)}
            saving={false}
          />
        )}
        {step === 3 && (
          <BusinessStep
            businessName={businessName}
            setBusinessName={setBusinessName}
            onNext={handleFinish}
            onBack={() => setStep(2)}
            saving={saving}
          />
        )}
        {step === 4 && <DoneStep onFinish={handleComplete} />}
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
    marginTop: 8,
    marginBottom: 16,
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
    paddingBottom: 120,
  },
  stepsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  stepsCardTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepRowNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepRowNumText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  stepRowText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8EEF8',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  externalLinkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primaryLight,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
  },
  infoBoxText: {
    flex: 1,
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
