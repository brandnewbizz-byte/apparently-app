/**
 * Push notification plumbing for the Apparently app.
 *
 * Responsibilities:
 *  1. Configure the foreground/background notification handler (banner + sound + badge).
 *  2. Request permission + fetch the device's Expo push token.
 *  3. Persist the token to `profiles.push_token` so the server can target this device.
 *  4. Keep the app icon badge in sync with unread counts.
 *
 * IMPORTANT: `expo-notifications` is a NATIVE module. It must NOT be statically
 * imported at the top of this file — a dev build that was compiled BEFORE this
 * native module was added would throw "Cannot find native module" during module
 * evaluation, crashing the entire app at startup (breaking image rendering,
 * profile editing, everything). We lazy-load it dynamically so a build without
 * the native module simply degrades to a no-op instead of crashing.
 *
 * The server side reads `profiles.push_token` and dispatches to Expo's push
 * service whenever a `notifications` / `messages` row is inserted.
 */
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const TAG = 'Notifications';

// EAS project id — required by Expo push service to route tokens.
const EAS_PROJECT_ID = '54d49c1b-d62e-4dc7-b463-6047ebd9845f';

type NotificationsModule = typeof import('expo-notifications');

// undefined = not attempted yet, null = unavailable, module = loaded.
let cachedModule: NotificationsModule | null | undefined;

/**
 * Lazily load `expo-notifications`. Returns null (and logs) if the native
 * module is missing on this build — never throws.
 */
async function loadNotifications(): Promise<NotificationsModule | null> {
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = await import('expo-notifications');
  } catch (e) {
    logger.warn(TAG, 'expo-notifications native module unavailable on this build', { e });
    cachedModule = null;
  }
  return cachedModule;
}

/**
 * Configure how notifications behave while the app is in the FOREGROUND.
 * Without this, foreground notifications are silently dropped.
 * Safe no-op on builds without the native module.
 */
export async function configureNotificationHandler(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request permission and return the Expo push token, or null if denied/unsupported.
 * Android 13+ requires the notification channel to exist first — see
 * `ensureNotificationChannel`.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  try {
    if (Platform.OS === 'android') {
      await ensureNotificationChannel();
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }

    if (!granted) {
      logger.info(TAG, 'Push permission denied');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    return token.data ?? null;
  } catch (e) {
    logger.warn(TAG, 'Failed to get Expo push token', { e });
    return null;
  }
}

/**
 * Create the Android notification channel (required on Android 8+/13+).
 * Safe to call repeatedly — it's idempotent.
 */
export async function ensureNotificationChannel(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#001F3D',
      sound: 'default',
    });
  } catch (e) {
    logger.warn(TAG, 'Failed to create notification channel', { e });
  }
}

/**
 * Persist this device's push token to the user's profile row.
 * The server reads `push_token` to send pushes.
 * `push_token` is a private column but the owner can UPDATE their own row.
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logger.warn(TAG, 'Failed to save push token', { message: error.message });
      return false;
    }
    logger.info(TAG, 'Push token saved', { userId: userId.slice(0, 8) });
    return true;
  } catch (e) {
    logger.warn(TAG, 'savePushToken exception', { e });
    return false;
  }
}

/**
 * Clear the push token on sign-out so the server stops sending to this device.
 */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ push_token: null, push_token_updated_at: null })
      .eq('id', userId);
  } catch (e) {
    logger.warn(TAG, 'clearPushToken exception', { e });
  }
}

/**
 * Register this device for push and persist the token for the given user.
 * Returns the token on success (or null if permission denied / no user).
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!userId) return null;
  const token = await getExpoPushToken();
  if (!token) return null;
  const saved = await savePushToken(userId, token);
  return saved ? token : null;
}

/**
 * Update the OS app-icon badge to the given unread count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch (e) {
    logger.warn(TAG, 'setBadgeCount exception', { e });
  }
}
