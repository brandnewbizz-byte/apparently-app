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

// ── What's on screen right now (so we don't double-notify) ──
let activeConversationUserId: string | null = null;
let inAppCallUiActive = false;

/** The chat screen calls this so pushes from that chat stay quiet while it's open. */
export function setActiveConversation(otherUserId: string | null): void {
  activeConversationUserId = otherUserId;
}

/** The person whose chat is open right now (null when no chat is open). */
export function getActiveConversation(): string | null {
  return activeConversationUserId;
}

/** True while the in-app incoming-call screen (or a call) is showing. */
export function setInAppCallUi(active: boolean): void {
  inAppCallUiActive = active;
}

export const CALL_CATEGORY = 'incoming_call';
export const CALL_CHANNEL = 'incoming_calls';
export const MESSAGE_CHANNEL = 'messages';

const isCallData = (d: any) => !!d && (d.kind === 'call' || d.type === 'call_request' || d.type === 'call');

/**
 * Configure how notifications behave while the app is in the FOREGROUND.
 * Like the big apps:
 *  - a call doesn't show a banner: the full-screen incoming-call screen rings instead
 *  - a message from the chat you have open stays quiet
 *  - everything else shows a banner with sound
 * Safe no-op on builds without the native module.
 */
export async function configureNotificationHandler(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data: any = n?.request?.content?.data || {};
      // While you're in the app, Apparently shows its own banner at the top
      // (components/InAppToast), like Instagram — so the phone's banner stays
      // quiet. The notification still goes in the list / notification shade.
      return {
        shouldShowBanner: false,
        shouldShowList: !isCallData(data),
        shouldPlaySound: false,
        shouldSetBadge: true,
      };
    },
  });
  // Answer / Decline buttons on call notifications.
  try {
    await Notifications.setNotificationCategoryAsync(CALL_CATEGORY, [
      { identifier: 'answer', buttonTitle: 'Answer', options: { opensAppToForeground: true } },
      { identifier: 'decline', buttonTitle: 'Decline', options: { opensAppToForeground: false, isDestructive: true } },
    ]);
  } catch (e) {
    logger.warn(TAG, 'Failed to set call category', { e });
  }
}

/** Remove call notifications from the tray (after answering / declining / a missed call). */
export async function dismissCallNotifications(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      if (isCallData(n.request.content.data)) await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  } catch {}
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
      name: 'Activity',
      description: 'Likes, comments, follows, orders and other updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E91E8C',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL, {
      name: 'Messages',
      description: 'New messages in your chats',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#E91E8C',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    // Calls ring for ~25 s (assets/sounds/ringtone.wav), pop over other apps
    // and show on the lock screen.
    await Notifications.setNotificationChannelAsync(CALL_CHANNEL, {
      name: 'Incoming calls',
      description: 'Rings when someone calls you on Apparently',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 600, 800, 600, 800, 600, 800, 600, 800, 600, 800],
      lightColor: '#22C55E',
      sound: 'ringtone.wav',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
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
 * iPhone: save (or clear) this device's VoIP push token, so calls ring on the
 * system call screen even when the app is closed or the phone is locked.
 * Kept in its own update so a database without the column (before migration
 * 036) never breaks the regular push token.
 */
export async function saveVoipToken(userId: string, token: string | null): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ voip_token: token || null, voip_token_updated_at: token ? new Date().toISOString() : null })
      .eq('id', userId);
    if (error) logger.warn(TAG, 'Failed to save VoIP token', { message: error.message });
  } catch (e) {
    logger.warn(TAG, 'saveVoipToken exception', { e });
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
  if (Platform.OS === 'ios') await saveVoipToken(userId, null);
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

// Responses already handled (getLastNotificationResponseAsync keeps returning the cold-start one).
const handledResponses = new Set<string>();

export interface NotificationTapHandlers {
  /** Open a route (string path or expo-router href object). */
  navigate: (href: any) => void;
  /** A call notification was tapped / answered. */
  onCall: (data: Record<string, any>, action: 'open' | 'answer' | 'decline') => void;
}

/**
 * Open the right screen when the user taps a push notification:
 *  - a call: Answer joins it, Decline hangs up, a plain tap shows the ringing screen
 *  - a message: that chat
 *  - a like / comment / follow / order: the post, profile or Notifications
 * Returns an unsubscribe function.
 */
export async function onNotificationTap(h: NotificationTapHandlers | ((path: string) => void)): Promise<() => void> {
  const handlers: NotificationTapHandlers = typeof h === 'function' ? { navigate: h, onCall: () => h('/notifications') } : h;
  const Notifications = await loadNotifications();
  if (!Notifications) return () => {};
  const seen = handledResponses;
  const handle = (resp: any) => {
    const req = resp?.notification?.request;
    const data = req?.content?.data;
    if (!data) return;
    const key = `${req?.identifier}:${resp?.actionIdentifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (isCallData(data)) {
      const a = resp.actionIdentifier === 'answer' ? 'answer' : resp.actionIdentifier === 'decline' ? 'decline' : 'open';
      handlers.onCall(data, a);
      return;
    }
    if (data.kind === 'message' && data.senderId) { handlers.navigate(`/inbox/conversation/${data.senderId}`); return; }
    if (data.kind === 'missed_call' && data.caller_id) { handlers.navigate(`/inbox/conversation/${data.caller_id}`); return; }
    if (data.type === 'follow' && (data.follower_id || data.actor_id)) { handlers.navigate(`/user/${data.follower_id || data.actor_id}`); return; }
    if (data.type === 'room_invite' && data.room_id) { handlers.navigate(`/(tabs)/live/room/${data.room_id}`); return; }
    handlers.navigate('/notifications');
  };
  try {
    // App opened from a cold start by tapping a notification
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) handle(last);
  } catch {}
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
