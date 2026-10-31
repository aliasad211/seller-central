// Push notifications: the phone's Firebase token is registered with Fazl after
// login as a Seller Central phone, apart from the Fazl app's, so the seller's
// selling notifications — a new order for their shop above all — arrive here,
// and their buying, chats and broadcasts stay in the Fazl app. Needs this
// app's google-services.json (see android/app/build.gradle); without it
// everything here quietly does nothing.
import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  FirebaseMessagingTypes,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api/http';

export type PushMessage = FirebaseMessagingTypes.RemoteMessage;

/** Whether this build has Firebase (its google-services.json). */
const available = () => {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
};

let stopTokenRefresh: (() => void) | null = null;

/**
 * Asks to show notifications (Android 13+, iOS), then registers this phone
 * with Fazl and keeps its token current. Safe to call on every login.
 */
export async function startPush(): Promise<void> {
  if (!available()) return;
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    const messaging = getMessaging();
    if (Platform.OS === 'ios') {
      const status = await requestPermission(messaging);
      if (status !== AuthorizationStatus.AUTHORIZED && status !== AuthorizationStatus.PROVISIONAL) {
        return;
      }
    }
    await register(await getToken(messaging));
    stopTokenRefresh?.();
    stopTokenRefresh = onTokenRefresh(messaging, token => {
      register(token).catch(() => undefined);
    });
  } catch {
    // No push this time; the app works the same without it.
  }
}

/** On log-out: this phone stops getting the seller's notifications. */
export async function stopPush(): Promise<void> {
  if (!available()) return;
  stopTokenRefresh?.();
  stopTokenRefresh = null;
  try {
    const messaging = getMessaging();
    const token = await getToken(messaging);
    await api('/seller/session/push-token/remove', { method: 'POST', body: { token } });
    await deleteToken(messaging);
  } catch {
    // The backend drops a dead token the next time it tries it.
  }
}

async function register(token: string) {
  if (!token) return;
  await api('/seller/session/push-token', { method: 'POST', body: { token } });
}

/** A notification that arrives while the app is open (the phone shows the rest itself). */
export function onPushWhileOpen(handler: (message: PushMessage) => void): () => void {
  if (!available()) return () => undefined;
  return onMessage(getMessaging(), handler);
}

/**
 * A notification the seller tapped: now (app in the background), and the one
 * that opened the app, if any.
 */
export function onPushTapped(handler: (message: PushMessage) => void): () => void {
  if (!available()) return () => undefined;
  const messaging = getMessaging();
  getInitialNotification(messaging)
    .then(message => {
      if (message) handler(message);
    })
    .catch(() => undefined);
  return onNotificationOpenedApp(messaging, handler);
}

/** Registered first thing (index.js): the phone shows background notifications itself. */
export function registerBackgroundPush(): void {
  if (!available()) return;
  setBackgroundMessageHandler(getMessaging(), async () => undefined);
}
