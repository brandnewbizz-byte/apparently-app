/**
 * Pops up "X is calling you" with Answer / Decline when a call comes in while
 * the app is open (calls arrive as call notifications in realtime) and rings.
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { answerParams, declineCall, isCallNotification, CALL_RING_MS } from '@/lib/calls';
import { playTone, stopTone } from '@/lib/callTones';
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
      if (!isCallNotification(n.type) || n.read || seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (now - new Date(n.createdAt).getTime() > CALL_RING_MS) continue; // too old to answer
      const me = { id: user.id, name: (user as any)?.fullName || (user as any)?.username || 'You' };
      const params = answerParams(n, me);
      const video = params.video === '1';
      // Ring (sound + vibration) until answered, declined or the caller gives up.
      playTone('ringtone');
      const left = Math.max(5_000, CALL_RING_MS - (now - new Date(n.createdAt).getTime()));
      const giveUp = setTimeout(stopTone, left);
      Alert.alert(
        video ? 'Incoming video call' : 'Incoming call',
        `${params.callerName} is calling you.`,
        [
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => {
              clearTimeout(giveUp);
              stopTone();
              markRead(n.id);
              declineCall(params.roomId, me.id, params.callerId);
            },
          },
          {
            text: 'Answer',
            onPress: () => {
              clearTimeout(giveUp);
              stopTone();
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
