/**
 * Incoming calls outside the app (background, other apps, locked phone,
 * app closed), like WhatsApp.
 *
 *  - iPhone: the call arrives as a VoIP push and rings on the system call
 *    screen (CallKit). Answer / Decline / hang up there come here as events.
 *  - Android: the push receiver shows a full-screen, ringing incoming-call
 *    notification with Answer / Decline. Taps come here as events.
 *
 * This file turns those events into the app's normal call flow: answering
 * opens the call screen, declining tells the caller "can't talk right now",
 * and hanging up on the system screen ends the call in the app.
 *
 * Phones on a build without the native module (and the web) keep the old
 * behaviour: the in-app incoming-call screen plus a regular push notification.
 */
import { AppState, Platform } from 'react-native';
import Calls, { type NativeCallEvent } from '@/modules/apparently-calls';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/supabaseClient';
import {
  answerIncomingScreen, callStillRinging, claimCall, declineCall, emitNativeCallAction,
  hasIncomingScreen, isCallUiActive, markCallNotificationRead, paramsFromPushData,
} from '@/lib/calls';
import { dismissCallNotifications, saveVoipToken } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const TAG = 'NativeCalls';

export function nativeCallsAvailable(): boolean {
  try { return !!Calls?.isSupported(); } catch { return false; }
}

/** iPhone: calls ring on the system call screen (a VoIP token is registered). */
export function systemCallScreenActive(): boolean {
  if (Platform.OS !== 'ios' || !Calls) return false;
  try { return !!Calls.getVoipToken(); } catch { return false; }
}

// ── Call screens hold "call mode" (Android: show over the lock screen) ──

const callModeHolders = new Set<string>();
export function holdCallMode(key: string): () => void {
  callModeHolders.add(key);
  try { Calls?.setCallMode(true); } catch {}
  return () => {
    callModeHolders.delete(key);
    if (callModeHolders.size === 0) { try { Calls?.setCallMode(false); } catch {} }
  };
}

/** The app's own incoming-call screen is ringing: stop the native ringing. */
export function dismissNativeIncoming(roomId: string) {
  try { Calls?.dismissIncoming(roomId); } catch {}
}

/** The call is over in the app: take it off the system call screen too. */
export function reportNativeCallEnded(roomId: string, reason: 'ended' | 'missed' | 'answeredElsewhere' | 'failed' = 'ended') {
  try { Calls?.reportEnded(roomId, reason).catch(() => {}); } catch {}
}

export function setNativeCallMuted(roomId: string, muted: boolean) {
  if (Platform.OS !== 'ios') return;
  try { Calls?.setMuted(roomId, muted).catch(() => {}); } catch {}
}

// ── Rooms answered on the system call screen (iPhone) ──

const systemAnswered = new Set<string>();
/** True when this call was answered on the iPhone's system call screen (CallKit owns its audio). */
export function answeredOnSystemScreen(roomId: string): boolean {
  return systemAnswered.has(roomId);
}

// ── Events ──

type Me = { id: string; name: string };
interface Ctx { me: Me; navigate: (href: any) => void }

/** While the system call screen rings, stop it if the caller hangs up. */
const callerWatch = new Map<string, () => void>();
function watchCaller(roomId: string, callerId: string) {
  if (!roomId || callerWatch.has(roomId)) return;
  const ch = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'call_ended' }, ({ payload }: any) => {
    if (systemAnswered.has(roomId)) return; // the call screen handles it
    if (!payload?.peerId || payload.peerId === callerId) {
      reportNativeCallEnded(roomId, 'missed');
      stopWatch(roomId);
    }
  });
  ch.subscribe();
  const stop = () => { supabase.removeChannel(ch).then(() => {}, () => {}); };
  const t = setTimeout(() => stopWatch(roomId), 60_000);
  callerWatch.set(roomId, () => { clearTimeout(t); stop(); });
}
function stopWatch(roomId: string) {
  callerWatch.get(roomId)?.();
  callerWatch.delete(roomId);
}

function ringStartedAt(e: NativeCallEvent): number {
  const t = typeof e.createdAt === 'number' ? e.createdAt : new Date(e.createdAt || Date.now()).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function handle(e: NativeCallEvent, ctx: Ctx) {
  const roomId = e.room_id || '';
  const data: Record<string, any> = { ...e, video: e.video === true || e.video === 'true' };
  switch (e.type) {
    case 'voipToken':
      saveVoipToken(ctx.me.id, e.token || null).catch(() => {});
      return;

    case 'incoming': {
      // iPhone: ringing on the system call screen.
      if (!roomId) return;
      if (!claimCall(roomId)) {
        // The app's own incoming-call screen got there first: keep that one.
        if (hasIncomingScreen(roomId)) reportNativeCallEnded(roomId, 'answeredElsewhere');
        return;
      }
      if (isCallUiActive()) {
        // Already on a call: busy.
        reportNativeCallEnded(roomId, 'failed');
        markCallNotificationRead(e.notificationId);
        declineCall(roomId, ctx.me.id, e.caller_id);
        return;
      }
      watchCaller(roomId, e.caller_id || '');
      return;
    }

    case 'answer': {
      if (!roomId) return;
      stopWatch(roomId);
      markCallNotificationRead(e.notificationId);
      dismissCallNotifications();
      if (Platform.OS === 'ios') systemAnswered.add(roomId);
      // The in-app ringing screen is open: answer there.
      if (answerIncomingScreen(roomId)) return;
      claimCall(roomId);
      const params = paramsFromPushData(data, ctx.me);
      ctx.navigate({
        pathname: '/call/[roomId]',
        params: { ...params, systemCall: Platform.OS === 'ios' ? '1' : '0' },
      });
      return;
    }

    case 'open': {
      // Android: the notification was tapped → the in-app ringing screen.
      if (!roomId || hasIncomingScreen(roomId)) return;
      if (!callStillRinging(e.createdAt)) { ctx.navigate('/notifications'); return; }
      if (!claimCall(roomId)) return;
      const params = paramsFromPushData(data, ctx.me);
      ctx.navigate({
        pathname: '/call/incoming',
        params: { ...params, notificationId: e.notificationId || '', ringStartedAt: String(ringStartedAt(e)) },
      });
      return;
    }

    case 'declined':
      // Android: "Decline" on the notification (the caller was already told).
      claimCall(roomId);
      markCallNotificationRead(e.notificationId);
      declineCall(roomId, ctx.me.id, e.caller_id);
      return;

    case 'ended':
      // iPhone: hung up or declined on the system call screen.
      stopWatch(roomId);
      if (e.answered || systemAnswered.has(roomId)) {
        emitNativeCallAction(roomId, { type: 'hangup' });
      } else {
        markCallNotificationRead(e.notificationId);
        declineCall(roomId, ctx.me.id, e.caller_id);
      }
      systemAnswered.delete(roomId);
      return;

    case 'missed':
      stopWatch(roomId);
      systemAnswered.delete(roomId);
      return;

    case 'mute':
      emitNativeCallAction(roomId, { type: 'mute', muted: !!e.muted });
      return;

    default:
      return;
  }
}

/**
 * Start handling native call events for the signed-in user. Call once the
 * app has finished its first navigation; returns a stop function.
 */
export function startNativeCalls(ctx: Ctx): () => void {
  const native = Calls;
  if (!native || !ctx.me.id) return () => {};
  try {
    if (Platform.OS === 'android') {
      native.configure({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, userId: ctx.me.id });
    }
    if (Platform.OS === 'ios') {
      const token = native.getVoipToken();
      if (token) saveVoipToken(ctx.me.id, token).catch(() => {});
    }
  } catch (e) {
    logger.warn(TAG, 'setup failed', { e });
  }

  const drain = () => {
    let events: NativeCallEvent[] = [];
    try { events = native.getPendingEvents() || []; } catch { return; }
    for (const e of events) {
      try { handle(e, ctx); } catch (err) { logger.warn(TAG, 'event failed', { type: e?.type, err }); }
    }
  };
  const sub = native.addListener('onCallEvent', drain);
  // Events that happened before JavaScript was running (answered from the lock screen, …).
  drain();
  // Coming back to the app: pick up anything missed while it was suspended.
  const app = AppState.addEventListener('change', (s) => { if (s === 'active') drain(); });
  return () => { sub.remove(); app.remove(); };
}
