/**
 * iPhone calls that ring like WhatsApp.
 *
 * The server sends a VoIP push for every incoming call. iOS wakes the app
 * (even closed or locked) and native code (plugins/withVoipCalls.js) shows the
 * system call screen right away. This file keeps each call's details, joins
 * the call when it's answered, tells the caller when it's declined, and stops
 * the ringing when the caller hangs up or nobody answers.
 */
import { NativeModules } from 'react-native';
import { supabase } from '@/lib/supabase';
import { CALL_RING_MS, claimCall, isCallUiActive, declineCall, markCallNotificationRead } from '@/lib/calls';
import type { CallKitHandlers } from './callkit';

export type { CallKitHandlers } from './callkit';

let RNCallKeep: any = null;
let VoipPush: any = null;
let RTCAudioSession: any = null;
try {
  if (NativeModules.RNCallKeep && NativeModules.RNVoipPushNotificationManager) {
    RNCallKeep = require('react-native-callkeep').default;
    VoipPush = require('react-native-voip-push-notification').default;
  }
} catch { RNCallKeep = null; VoipPush = null; }
try { RTCAudioSession = require('react-native-webrtc').RTCAudioSession; } catch {}

type Ringing = {
  uuid: string;
  data: Record<string, any>;
  answered: boolean;
  stop: () => void;
};

const calls = new Map<string, Ringing>(); // by uuid
const roomToUuid = new Map<string, string>();
const hangUps = new Map<string, Set<() => void>>(); // by roomId
let tokenSaved = false;

const REASON_REMOTE_ENDED = 2;
const REASON_UNANSWERED = 3;

export function callKitReady(): boolean { return !!RNCallKeep && tokenSaved; }
export function callKitHasRoom(roomId: string): boolean { return roomToUuid.has(roomId); }

function forget(uuid: string) {
  const c = calls.get(uuid);
  if (!c) return;
  c.stop();
  calls.delete(uuid);
  const room = c.data.roomId;
  if (room) claimCall(room); // handled: the app mustn't ring for it again
  if (room && roomToUuid.get(room) === uuid) roomToUuid.delete(room);
}

export function callKitEndRoom(roomId: string): void {
  const uuid = roomToUuid.get(roomId);
  if (!uuid || !RNCallKeep) return;
  try { RNCallKeep.reportEndCallWithUUID(uuid, REASON_REMOTE_ENDED); } catch {}
  forget(uuid);
}

export function onCallKitHangUp(roomId: string, fn: () => void): () => void {
  let set = hangUps.get(roomId);
  if (!set) { set = new Set(); hangUps.set(roomId, set); }
  set.add(fn);
  return () => { set?.delete(fn); };
}

async function saveVoipToken(userId: string, token: string) {
  if (!token) return;
  try {
    const { error } = await supabase.from('profiles')
      .update({ voip_token: token, voip_token_updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (!error) tokenSaved = true;
  } catch {}
}

export async function clearVoipToken(userId: string): Promise<void> {
  tokenSaved = false;
  try { await supabase.from('profiles').update({ voip_token: null, voip_token_updated_at: null }).eq('id', userId); } catch {}
}

export function startCallKit(h: CallKitHandlers): () => void {
  if (!RNCallKeep || !VoipPush) return () => {};

  /** A VoIP push arrived: keep its details and watch for the caller hanging up. */
  const remember = (payload: any) => {
    const data = { ...(payload || {}) };
    const uuid: string = String(data.uuid || '').toLowerCase();
    if (!uuid || calls.has(uuid)) { if (uuid) VoipPush.onVoipNotificationCompleted(uuid); return; }
    const roomId: string = data.roomId || '';

    // Already on another call: tell this caller we're busy.
    if (isCallUiActive()) {
      try { RNCallKeep.reportEndCallWithUUID(uuid, REASON_UNANSWERED); } catch {}
      if (roomId) claimCall(roomId);
      markCallNotificationRead(data.notificationId);
      declineCall(roomId, h.userId, data.callerId);
      VoipPush.onVoipNotificationCompleted(uuid);
      return;
    }

    let ch: ReturnType<typeof supabase.channel> | null = null;
    const created = Number(new Date(data.createdAt || Date.now()).getTime()) || Date.now();
    const timer = setTimeout(() => {
      const c = calls.get(uuid);
      if (c && !c.answered) {
        try { RNCallKeep.reportEndCallWithUUID(uuid, REASON_UNANSWERED); } catch {}
        forget(uuid);
      }
    }, Math.max(5_000, CALL_RING_MS - (Date.now() - created)));
    if (roomId) {
      ch = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'call_ended' }, ({ payload: p }: any) => {
        const c = calls.get(uuid);
        if (!c || c.answered) return; // the call screen handles hang-ups once answered
        if (p?.peerId && p.peerId !== data.callerId) return;
        try { RNCallKeep.reportEndCallWithUUID(uuid, REASON_REMOTE_ENDED); } catch {}
        forget(uuid);
      });
      ch.subscribe();
    }
    calls.set(uuid, {
      uuid,
      data,
      answered: false,
      stop: () => {
        clearTimeout(timer);
        if (ch) supabase.removeChannel(ch).then(() => {}, () => {});
        ch = null;
      },
    });
    if (roomId) roomToUuid.set(roomId, uuid);
    VoipPush.onVoipNotificationCompleted(uuid);
  };

  const answer = ({ callUUID }: { callUUID: string }) => {
    const uuid = String(callUUID || '').toLowerCase();
    const c = calls.get(uuid);
    if (!c || c.answered) return;
    c.answered = true;
    c.stop(); // the call screen takes over from here
    h.onAnswer(c.data);
  };

  const end = ({ callUUID }: { callUUID: string }) => {
    const uuid = String(callUUID || '').toLowerCase();
    const c = calls.get(uuid);
    if (!c) return;
    if (c.answered) {
      hangUps.get(c.data.roomId)?.forEach((fn) => { try { fn(); } catch {} });
    } else {
      h.onDecline(c.data);
    }
    forget(uuid);
  };

  const onVoip = (name: string, data: any) => {
    if (name === VoipPush.RNVoipPushRemoteNotificationsRegisteredEvent) saveVoipToken(h.userId, data);
    else if (name === VoipPush.RNVoipPushRemoteNotificationReceivedEvent) remember(data);
  };
  VoipPush.addEventListener('register', (token: string) => saveVoipToken(h.userId, token));
  VoipPush.addEventListener('notification', (payload: any) => remember(payload));
  VoipPush.addEventListener('didLoadWithEvents', (events: any[]) => {
    for (const e of events || []) onVoip(e?.name, e?.data);
  });
  // Answers tapped before the app finished starting (cold start from the lock
  // screen). Runs a moment later so the call's details above are in first.
  const initialTimer = setTimeout(() => {
    RNCallKeep.getInitialEvents?.().then((initial: any[]) => {
      for (const e of initial || []) {
        if (e?.name === 'RNCallKeepPerformAnswerCallAction') answer(e.data);
        else if (e?.name === 'RNCallKeepPerformEndCallAction') end(e.data);
        else if (e?.name === 'RNCallKeepDidActivateAudioSession') { try { RTCAudioSession?.audioSessionDidActivate(); } catch {} }
      }
      RNCallKeep.clearInitialEvents?.();
    }, () => {});
  }, 400);

  RNCallKeep.addEventListener('answerCall', answer);
  RNCallKeep.addEventListener('endCall', end);
  // WebRTC uses the audio CallKit turns on.
  RNCallKeep.addEventListener('didActivateAudioSession', () => { try { RTCAudioSession?.audioSessionDidActivate(); } catch {} });
  RNCallKeep.addEventListener('didDeactivateAudioSession', () => { try { RTCAudioSession?.audioSessionDidDeactivate(); } catch {} });

  return () => {
    clearTimeout(initialTimer);
    VoipPush.removeEventListener('register');
    VoipPush.removeEventListener('notification');
    VoipPush.removeEventListener('didLoadWithEvents');
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didActivateAudioSession');
    RNCallKeep.removeEventListener('didDeactivateAudioSession');
  };
}
