import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import { apiRequest } from './query-client';
import { useAuth } from './auth-context';

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
  openCheckout: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) {
      setIsPro(false);
      setSubscription(null);
      return false;
    }

    try {
      const res = await apiRequest('GET', '/api/stripe/subscription-status');
      const data = await res.json();
      setIsPro(data.active);
      setSubscription(data.subscription);
      return data.active;
    } catch (err) {
      console.log('Subscription check error:', err);
      return false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    async function init() {
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
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, checkSubscription]);

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

  const openCheckout = useCallback(async () => {
    try {
      const res = await apiRequest('POST', '/api/stripe/create-checkout');
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch (err) {
      console.error('Checkout error:', err);
      throw err;
    }
  }, []);

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
      isLoading,
      subscription,
      checkSubscription,
      openCheckout,
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
