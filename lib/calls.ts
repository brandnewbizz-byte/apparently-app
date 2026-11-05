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
/** Screens currently ringing or on a live call (keyed so one closing never clears another). */
const callUiOwners = new Set<string>();

/** First caller wins: returns false if this call is already ringing / answered / declined. */
export function claimCall(roomId: string): boolean {
  if (!roomId || handledRooms.has(roomId)) return false;
  handledRooms.add(roomId);
  return true;
}

/**
 * The incoming-call screen and the call screen mark themselves while they are
 * ringing or on a live call. Each passes its own key, so a screen that closes
 * (or a call that just ended) never clears the mark of a newer call.
 */
export function setCallUiActive(on: boolean, key = 'default') {
  if (on) callUiOwners.add(key);
  else callUiOwners.delete(key);
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

// ── The in-app ringing screen, so a tap on the system call screen or the
//    notification can answer it instead of opening a second one ──

const incomingScreens = new Map<string, () => void>();

/** The incoming-call screen registers itself while it rings. */
export function registerIncomingScreen(roomId: string, answer: () => void): () => void {
  if (!roomId) return () => {};
  incomingScreens.set(roomId, answer);
  return () => { if (incomingScreens.get(roomId) === answer) incomingScreens.delete(roomId); };
}
export function hasIncomingScreen(roomId: string): boolean { return incomingScreens.has(roomId); }
/** Answer the call on its ringing screen; false if that screen isn't open. */
export function answerIncomingScreen(roomId: string): boolean {
  const fn = incomingScreens.get(roomId);
  if (!fn) return false;
  fn();
  return true;
}

// ── Hang up / mute from the phone's own call screen (iPhone CallKit) ──

export type NativeCallAction = { type: 'hangup' } | { type: 'mute'; muted: boolean };
const callActionListeners = new Map<string, Set<(a: NativeCallAction) => void>>();
export function onNativeCallAction(roomId: string, fn: (a: NativeCallAction) => void): () => void {
  const set = callActionListeners.get(roomId) ?? new Set();
  set.add(fn);
  callActionListeners.set(roomId, set);
  return () => { set.delete(fn); if (!set.size) callActionListeners.delete(roomId); };
}
export function emitNativeCallAction(roomId: string, a: NativeCallAction) {
  callActionListeners.get(roomId)?.forEach((fn) => { try { fn(a); } catch {} });
}

/**
 * The caller hung up (or gave up) before the other person answered: stop it
 * ringing on their phone — their lock screen / notification too, not just the
 * app. Needs migration 036 (cancel_call); older databases just let it time out.
 */
export async function cancelRing(roomId?: string): Promise<void> {
  if (!roomId) return;
  try { await supabase.rpc('cancel_call', { p_room_id: roomId }); } catch {}
}
