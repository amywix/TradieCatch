import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import Colors from '@/constants/colors';
import { useSubscription } from '@/lib/subscription-context';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { purchasePackage, restorePurchases } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        const monthly = offerings.current.availablePackages.find(
          p => p.packageType === 'MONTHLY'
        ) || offerings.current.availablePackages[0] || null;
        setMonthlyPackage(monthly);
      }
    } catch (err) {
      console.log('RevenueCat offerings error (expected in dev):', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = useCallback(async () => {
    if (!monthlyPackage) {
      Alert.alert(
        'Subscription',
        'Subscriptions will be available once the app is published to the App Store. For now, you can explore the app freely.',
        [
          { text: 'Continue to App', onPress: () => router.replace('/onboarding') },
        ]
      );
      return;
    }

    setPurchasing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const success = await purchasePackage(monthlyPackage);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/onboarding');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }, [monthlyPackage, purchasePackage]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Restored!', 'Your subscription has been restored.', [
          { text: 'Continue', onPress: () => router.replace('/onboarding') },
        ]);
      } else {
        Alert.alert('No subscription found', 'We couldn\'t find an active subscription for this account.');
      }
    } catch {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [restorePurchases]);

  const handleSkipForNow = useCallback(() => {
    router.replace('/onboarding');
  }, []);

  return (
    <View style={[styles.container, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 16 }]}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconBg}>
            <Ionicons name="flash" size={48} color={Colors.accent} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={styles.title}>TradieCatch Pro</Text>
          <Text style={styles.subtitle}>
            Everything you need to never miss a job again
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.featuresList}>
          <PaywallFeature icon="chatbubbles" text="Unlimited auto-SMS replies" />
          <PaywallFeature icon="construct" text="Automated job booking via SMS" />
          <PaywallFeature icon="calendar" text="Full job management dashboard" />
          <PaywallFeature icon="analytics" text="Conversation tracking & history" />
          <PaywallFeature icon="shield-checkmark" text="Priority customer support" />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.priceCard}>
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>MOST POPULAR</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>$99</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
          <Text style={styles.priceDesc}>Cancel anytime. No lock-in contracts.</Text>
        </Animated.View>
      </Animated.View>

      <View style={[styles.bottomSection, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16 }]}>
        <Pressable
          style={[styles.subscribeBtn, (purchasing || loading) && styles.subscribeBtnDisabled]}
          onPress={handleSubscribe}
          disabled={purchasing || loading}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={styles.subscribeBtnText}>
                {monthlyPackage ? 'Subscribe - $99/month' : 'Start Free Trial'}
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.linksRow}>
          <Pressable onPress={handleRestore} disabled={restoring}>
            <Text style={styles.linkText}>
              {restoring ? 'Restoring...' : 'Restore Purchase'}
            </Text>
          </Pressable>
          <Text style={styles.linkDot}>|</Text>
          <Pressable onPress={handleSkipForNow}>
            <Text style={styles.linkText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PaywallFeature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureCheck}>
        <Ionicons name="checkmark" size={16} color={Colors.white} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  featuresList: {
    marginTop: 28,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  priceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    marginTop: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  priceBadge: {
    backgroundColor: Colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  priceBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
    letterSpacing: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  pricePeriod: {
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  priceDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 6,
  },
  bottomSection: {
    paddingHorizontal: 24,
    gap: 14,
  },
  subscribeBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnDisabled: {
    opacity: 0.6,
  },
  subscribeBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  linkDot: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
