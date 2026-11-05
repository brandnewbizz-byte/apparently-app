/**
 * Opens the full-screen incoming-call screen when a call comes in while the
 * app is open (calls arrive as call notifications in realtime). Also answers,
 * declines or shows calls tapped from a push notification.
 *
 * Only while the app is in front: in the background, on another app or with
 * the phone locked, the phone's own incoming-call screen rings instead
 * (lib/nativeCalls — iPhone CallKit, Android's full-screen call notification).
 * If you come back to the app while a call is still ringing, it shows here.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  answerParams, claimCall, declineCall, isCallNotification, isCallUiActive,
  markCallNotificationRead, CALL_RING_MS,
} from '@/lib/calls';
import { callsAvailable } from '@/lib/webrtc';
import { nativeCallsAvailable, systemCallScreenActive } from '@/lib/nativeCalls';

/** iPhone with CallKit: how long the system call screen gets to show the call first. */
const SYSTEM_SCREEN_GRACE_MS = 2500;

export default function IncomingCallWatcher() {
  const { notifications } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const seen = useRef(new Set<string>());
  const waiting = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => () => { waiting.current.forEach((t) => clearTimeout(t)); }, []);

  useEffect(() => {
    if (!user?.id || !callsAvailable()) return;
    // Phones with native incoming calls ring on the phone's own screen while
    // the app isn't in front; check again when you come back to the app.
    if (!appActive && nativeCallsAvailable()) return;
    const now = Date.now();
    const me = { id: user.id, name: (user as any)?.fullName || (user as any)?.username || 'You' };

    const ring = (n: (typeof notifications)[number]) => {
      const started = new Date(n.createdAt).getTime();
      if (Date.now() - started > CALL_RING_MS) return; // too old to answer
      const params = answerParams(n, me);
      if (!claimCall(params.roomId)) return; // already ringing (system call screen, a push tap, …)
      if (isCallUiActive()) {
        // Already on a call or another call is ringing: tell this caller we're busy.
        markCallNotificationRead(n.id);
        declineCall(params.roomId, me.id, params.callerId);
        return;
      }
      router.push({
        pathname: '/call/incoming' as any,
        params: { ...params, notificationId: n.id, ringStartedAt: String(started) } as any,
      } as any);
    };

    for (const n of notifications) {
      if (!isCallNotification(n.type) || n.read || seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      const started = new Date(n.createdAt).getTime();
      if (now - started > CALL_RING_MS) continue; // too old to answer
      if (Platform.OS === 'ios' && systemCallScreenActive()) {
        // The VoIP push normally gets here first and rings on the system call
        // screen; only ring in the app if it didn't.
        waiting.current.set(n.id, setTimeout(() => { waiting.current.delete(n.id); ring(n); }, SYSTEM_SCREEN_GRACE_MS));
        continue;
      }
      ring(n);
      break; // one at a time
    }
  }, [notifications, user, router, appActive]);

  return null;
}
