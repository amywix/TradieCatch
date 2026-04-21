import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './auth-context';
import { apiRequest } from './query-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8C00',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse.data;
  } catch (err) {
    console.error('Failed to get Expo push token:', err);
    return null;
  }
}

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuth();
  const lastSentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (Platform.OS === 'web') return;

    let cancelled = false;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (cancelled || !token) return;
      if (lastSentTokenRef.current === token) return;
      try {
        await apiRequest('POST', '/api/push-token', { token });
        lastSentTokenRef.current = token;
        console.log('Push token registered');
      } catch (err) {
        console.error('Failed to register push token:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);
}
