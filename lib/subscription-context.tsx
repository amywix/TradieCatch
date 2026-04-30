import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';
import { useAuth } from './auth-context';

const SUBSCRIPTION_CACHE_KEY = 'tradiecatch_is_pro';

interface SubscriptionInfo {
  id: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface SubscriptionContextValue {
  isPro: boolean;
  isLoading: boolean;
  subscription: SubscriptionInfo | null;
  checkSubscription: () => Promise<boolean>;
  openCustomerPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  // Start from cached value so subscribers never see the paywall flash on load
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Load persisted isPro from storage first so we can skip the paywall immediately
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
        if (cached === 'true') {
          setIsPro(true);
        }
      } catch {}
      setCacheLoaded(true);
    })();
  }, []);

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) {
      setIsPro(false);
      setSubscription(null);
      await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY).catch(() => {});
      return false;
    }

    try {
      const res = await apiRequest('GET', '/api/stripe/subscription-status');
      const data = await res.json();
      const active: boolean = !!data.active;
      setIsPro(active);
      setSubscription(data.subscription ?? null);
      // Persist so the next app open starts correctly
      await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, active ? 'true' : 'false').catch(() => {});
      return active;
    } catch (err) {
      // Network / server error — keep the current isPro state (don't kick subscribers out)
      console.log('Subscription check error (keeping last known state):', err);
      return isPro;
    }
  }, [isAuthenticated, isPro]);

  useEffect(() => {
    if (!cacheLoaded) return;

    let mounted = true;

    async function init() {
      if (mounted) setIsLoading(true);
      try {
        await checkSubscription();
      } catch {
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    if (isAuthenticated) {
      init();
    } else {
      setIsPro(false);
      setSubscription(null);
      AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY).catch(() => {});
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, cacheLoaded]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkSubscription();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated, checkSubscription]);

  const openCustomerPortal = useCallback(async () => {
    try {
      const res = await apiRequest('POST', '/api/stripe/customer-portal');
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch (err) {
      console.error('Customer portal error:', err);
      throw err;
    }
  }, []);

  return (
    <SubscriptionContext.Provider value={{
      isPro,
      isLoading: isLoading || !cacheLoaded,
      subscription,
      checkSubscription,
      openCustomerPortal,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
