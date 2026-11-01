/**
 * Pops up "X is calling you" with Answer / Decline when a call comes in while
 * the app is open (calls arrive as `call_request` notifications in realtime).
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { answerParams, declineCall, CALL_RING_MS } from '@/lib/calls';
import { callsAvailable } from '@/lib/webrtc';

export default function IncomingCallWatcher() {
  const { notifications, markRead } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!user?.id || !callsAvailable()) return;
    const now = Date.now();
    for (const n of notifications) {
      if (n.type !== 'call_request' || n.read || seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (now - new Date(n.createdAt).getTime() > CALL_RING_MS) continue; // too old to answer
      const me = { id: user.id, name: (user as any)?.fullName || (user as any)?.username || 'You' };
      const params = answerParams(n, me);
      const video = params.video === '1';
      Alert.alert(
        video ? 'Incoming video call' : 'Incoming call',
        `${params.callerName} is calling you.`,
        [
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => {
              markRead(n.id);
              declineCall(params.roomId, me.id, params.callerId);
            },
          },
          {
            text: 'Answer',
            onPress: () => {
              markRead(n.id);
              router.push({ pathname: '/call/[roomId]' as any, params: params as any } as any);
            },
          },
        ],
        { cancelable: false },
      );
      break; // one popup at a time
    }
  }, [notifications, user, markRead, router]);

  return null;
}
