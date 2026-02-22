import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

interface SubscriptionContextValue {
  isPro: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  checkSubscription: () => Promise<boolean>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const ENTITLEMENT_ID = 'pro';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const active = !!info.entitlements.active[ENTITLEMENT_ID];
      setIsPro(active);
      return active;
    } catch (err) {
      console.log('Subscription check error (expected in dev):', err);
      return false;
    }
  }, []);

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

    init();

    Purchases.addCustomerInfoUpdateListener((info) => {
      if (!mounted) return;
      setCustomerInfo(info);
      setIsPro(!!info.entitlements.active[ENTITLEMENT_ID]);
    });

    return () => {
      mounted = false;
    };
  }, [checkSubscription]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkSubscription();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [checkSubscription]);

  const purchasePackageHandler = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      const active = !!info.entitlements.active[ENTITLEMENT_ID];
      setIsPro(active);
      return active;
    } catch (err: any) {
      if (err.userCancelled) return false;
      throw err;
    }
  }, []);

  const restorePurchasesHandler = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const active = !!info.entitlements.active[ENTITLEMENT_ID];
      setIsPro(active);
      return active;
    } catch (err) {
      throw err;
    }
  }, []);

  return (
    <SubscriptionContext.Provider value={{
      isPro,
      isLoading,
      customerInfo,
      checkSubscription,
      purchasePackage: purchasePackageHandler,
      restorePurchases: restorePurchasesHandler,
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
