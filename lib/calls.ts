/**
 * Helpers shared by the chat screen, the Notifications screen and the
 * incoming-call popup: start a call, answer one, or decline one.
 */
import { supabase } from '@/lib/supabase';
import { closeChannel, openFreshChannel, subscribed } from '@/lib/realtimeChannels';

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
  const topic = `call:${roomId}`;
  // Already listening on this call (e.g. the ringing screen): send on that one.
  const live = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (live && (live as any).state === 'joined') {
    try { await live.send({ type: 'broadcast', event, payload }); } catch {}
    return;
  }
  const ch = await openFreshChannel(topic, { config: { broadcast: { self: false } } });
  await subscribed(ch, 5000);
  try {
    await ch.send({ type: 'broadcast', event, payload });
  } catch {}
  closeChannel(ch);
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
  const row = (type: string) => ({
    user_id: targetId,
    actor_id: me.id,
    actor_name: me.name,
    actor_avatar: me.avatar || null,
    type,
    title: video ? `${me.name} is video calling you` : `${me.name} is calling you`,
    body: video ? 'Incoming video call' : 'Incoming call',
    data: { room_id: roomId, caller_id: me.id, caller_name: me.name, caller_avatar: me.avatar || '', video },
    read: false,
    created_at: new Date().toISOString(),
  });
  const { error } = await supabase.from('notifications').insert(row('call_request'));
  // Older databases only allow the type 'call'.
  if (error) {
    const { error: e2 } = await supabase.from('notifications').insert(row('call'));
    if (e2) throw e2;
  }
}

/** Both names are used for call notifications. */
export const isCallNotification = (type?: string | null) => type === 'call_request' || type === 'call';

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

// ── Ringing state shared by the popup, push taps and the call screens ──

const handledRooms = new Set<string>();
// Which screens are busy with a call right now (ringing or talking). Kept per
// screen so one screen closing never frees the phone while another is on.
const callUiOwners = new Set<string>();

/** First caller wins: returns false if this call is already ringing / answered / declined. */
export function claimCall(roomId: string): boolean {
  if (!roomId || handledRooms.has(roomId)) return false;
  handledRooms.add(roomId);
  return true;
}

/** The incoming-call screen and the call screen mark themselves while open. */
export function setCallUiActive(on: boolean, owner = 'default') {
  if (on) callUiOwners.add(owner); else callUiOwners.delete(owner);
}
export function isCallUiActive() { return callUiOwners.size > 0; }

/** Mark a call notification as handled so it stops ringing everywhere. */
export async function markCallNotificationRead(notificationId?: string | null): Promise<void> {
  if (!notificationId) return;
  try { await supabase.from('notifications').update({ read: true }).eq('id', notificationId); } catch {}
}

/** Screen params for a call from a push notification's data. */
export function paramsFromPushData(data: Record<string, any>, me: { id: string; name: string }): CallScreenParams {
  return answerParams(
    { actorId: data.caller_id || null, actorName: data.caller_name || 'Someone', actorAvatar: data.caller_avatar || '', data },
    me,
  );
}

/** True while a call notification can still be answered. */
export function callStillRinging(createdAt?: string | number | null): boolean {
  if (!createdAt) return true;
  const t = typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
  return !Number.isFinite(t) || Date.now() - t < CALL_RING_MS;
}

/** Tell the person you called that they missed it (shows in their Notifications). */
export async function sendMissedCall(opts: { me: { id: string; name: string; avatar?: string }; targetId: string; video: boolean }): Promise<void> {
  const { me, targetId, video } = opts;
  if (!targetId || targetId === me.id) return;
  try {
    await supabase.from('notifications').insert({
      user_id: targetId,
      actor_id: me.id,
      actor_name: me.name,
      actor_avatar: me.avatar || null,
      type: 'general',
      title: video ? 'Missed video call' : 'Missed call',
      body: `${me.name} tried to call you`,
      data: { kind: 'missed_call', caller_id: me.id, caller_name: me.name, video },
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch {}
}
