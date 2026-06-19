import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { AuthUser, registerPushToken } from './apiClient';

const driverOrderCategoryId = 'driver_order_offer';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configurePushNotifications(user?: AuthUser) {
  if (!user || Platform.OS === 'web' || !Device.isDevice) {
    return;
  }

  await ensureDriverOfferCategory();

  const permission = await Notifications.getPermissionsAsync();
  const finalPermission =
    permission.status === 'granted' ? permission : await Notifications.requestPermissionsAsync();

  if (finalPermission.status !== 'granted') {
    console.info('[push] notification permission was not granted');
    return;
  }

  const devicePushToken = await Notifications.getDevicePushTokenAsync();
  const token = String(devicePushToken.data || '').trim();

  if (!token) {
    console.info('[push] native device token is empty');
    return;
  }

  await registerPushToken({
    appOwnership: String((globalThis as { Expo?: { appOwnership?: string } }).Expo?.appOwnership || ''),
    deviceName: Device.deviceName || undefined,
    deviceType: Device.deviceType ? String(Device.deviceType) : undefined,
    platform: Platform.OS,
    role: user.role,
    token,
    tokenType: normalizeDeviceTokenType(devicePushToken.type),
    userId: user.id,
  });

  console.info('[push] device token registered', {
    platform: Platform.OS,
    role: user.role,
    tokenType: normalizeDeviceTokenType(devicePushToken.type),
    userId: user.id,
  });
}

async function ensureDriverOfferCategory() {
  await Notifications.setNotificationCategoryAsync(driverOrderCategoryId, [
    {
      buttonTitle: 'Принять',
      identifier: 'accept_order',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      buttonTitle: 'Пропустить',
      identifier: 'skip_order',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);
}

function normalizeDeviceTokenType(type: string) {
  if (Platform.OS === 'android') {
    return 'fcm';
  }

  if (Platform.OS === 'ios') {
    return 'apns';
  }

  return type || 'expo';
}
