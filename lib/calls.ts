/**
 * Helpers shared by the chat screen, the Notifications screen and the
 * incoming-call popup: start a call, answer one, or decline one.
 */
import { supabase } from '@/lib/supabase';

export interface CallScreenParams {
  roomId: string;
  callerId: string;
  callerName: string;
  targetId: string;
  targetName: string;
  isOutgoing: '1' | '0';
  currentUserId: string;
  currentUserName: string;
  video: '1' | '0';
  peerAvatar: string;
}

/** A call notification older than this can't be answered any more. */
export const CALL_RING_MS = 45_000;

/** Send one message on a call's signalling channel (used to decline). */
export async function sendCallSignal(roomId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  const ch = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false } } });
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 5000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        resolve();
      }
    });
  });
  try {
    await ch.send({ type: 'broadcast', event, payload });
  } catch {}
  supabase.removeChannel(ch).then(() => {}, () => {});
}

/** Tell the caller we're not picking up, so their screen stops ringing. */
export function declineCall(roomId?: string, myId?: string, callerId?: string | null) {
  if (!roomId || !myId) return;
  sendCallSignal(roomId, 'call_declined', { roomId, peerId: myId, targetPeerId: callerId || '' }).catch(() => {});
}

/** Ring someone: saves a call notification for them (which also sends a push). */
export async function ringUser(opts: {
  me: { id: string; name: string; avatar?: string };
  targetId: string;
  roomId: string;
  video: boolean;
}): Promise<void> {
  const { me, targetId, roomId, video } = opts;
  await supabase.from('notifications').insert({
    user_id: targetId,
    actor_id: me.id,
    type: 'call_request',
    title: video ? `${me.name} is video calling you` : `${me.name} is calling you`,
    body: video ? 'Incoming video call' : 'Incoming call',
    data: { room_id: roomId, caller_id: me.id, caller_name: me.name, caller_avatar: me.avatar || '', video },
    read: false,
    created_at: new Date().toISOString(),
  });
}

/** Screen params for answering a call notification. */
export function answerParams(
  n: { actorId: string | null; actorName: string; actorAvatar: string; data: Record<string, any> },
  me: { id: string; name: string },
): CallScreenParams {
  return {
    roomId: n.data?.room_id || `call-${Date.now()}`,
    callerId: n.actorId || n.data?.caller_id || '',
    callerName: n.data?.caller_name || n.actorName || 'Someone',
    targetId: me.id,
    targetName: me.name,
    isOutgoing: '0',
    currentUserId: me.id,
    currentUserName: me.name,
    video: n.data?.video ? '1' : '0',
    peerAvatar: n.data?.caller_avatar || n.actorAvatar || '',
  };
}
