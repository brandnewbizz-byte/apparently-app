/**
 * Opens the full-screen incoming-call screen when a call comes in while the
 * app is open (calls arrive as call notifications in realtime). Also answers,
 * declines or shows calls tapped from a push notification.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  answerParams, claimCall, declineCall, isCallNotification, isCallUiActive,
  markCallNotificationRead, CALL_RING_MS,
} from '@/lib/calls';
import { callsAvailable } from '@/lib/webrtc';

export default function IncomingCallWatcher() {
  const { notifications } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!user?.id || !callsAvailable()) return;
    const now = Date.now();
    for (const n of notifications) {
      if (!isCallNotification(n.type) || n.read || seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      const started = new Date(n.createdAt).getTime();
      if (now - started > CALL_RING_MS) continue; // too old to answer
      const me = { id: user.id, name: (user as any)?.fullName || (user as any)?.username || 'You' };
      const params = answerParams(n, me);
      if (!claimCall(params.roomId)) continue; // already ringing (e.g. opened from the push)
      if (isCallUiActive()) {
        // Already on a call or another call is ringing: tell this caller we're busy.
        markCallNotificationRead(n.id);
        declineCall(params.roomId, me.id, params.callerId);
        continue;
      }
      router.push({
        pathname: '/call/incoming' as any,
        params: { ...params, notificationId: n.id, ringStartedAt: String(started) } as any,
      } as any);
      break; // one at a time
    }
  }, [notifications, user, router]);

  return null;
}
