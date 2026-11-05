/**
 * Call and live-voice audio on phones (react-native-incall-manager).
 *
 * WebRTC needs the phone in "call" audio mode: the mic and the speaker both
 * open, echo cancellation on, and the sound sent to the speaker or the
 * earpiece on purpose. Switching modes with expo-audio during a call (for the
 * ringing sounds) could shut WebRTC's audio off — that's why people on a call
 * sometimes couldn't hear each other, and why live posts sometimes played
 * through the quiet earpiece instead of the speaker.
 *
 * Calls and live voice share this one switch, so ending one never cuts the other.
 * Builds without the native module (web, older app versions) fall back to the
 * old behaviour.
 */
import { Platform } from 'react-native';

type ICM = typeof import('react-native-incall-manager').default;

let cached: ICM | null | undefined;
function icm(): ICM | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('react-native-incall-manager');
    cached = (m?.default ?? m) as ICM;
    if (!cached || typeof cached.start !== 'function') cached = null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when this build can manage call audio itself. */
export function callAudioAvailable(): boolean {
  return !!icm();
}

let callOn = false;
let liveOn = 0;
let started = false;

function safe(fn: (m: ICM) => void) {
  const m = icm();
  if (!m) return;
  try { fn(m); } catch (e) { console.log('[callAudio]', e); }
}

function ensureStarted(media: 'audio' | 'video', ringback?: string) {
  if (started) return;
  started = true;
  safe((m) => m.start({ media, auto: media === 'audio', ringback: ringback || '' }));
}

function maybeStop() {
  if (callOn || liveOn > 0 || !started) return;
  started = false;
  safe((m) => { m.setForceSpeakerphoneOn(false); m.setKeepScreenOn(false); m.stop(); });
}

// ── Calls ──

/**
 * Start call audio. The caller hears ringback until `callConnected()`.
 * `systemCall`: answered on the iPhone's own call screen (CallKit), which
 * sets up and turns on the call's audio itself — starting it here too can
 * leave the call silent, so only the speaker switch is used then.
 */
export function callStart(opts: { video: boolean; outgoing: boolean; systemCall?: boolean }) {
  callOn = true;
  if (opts.systemCall && Platform.OS === 'ios') return;
  started = false; // a call always takes over the audio setup
  ensureStarted(opts.video ? 'video' : 'audio', opts.outgoing ? '_DEFAULT_' : '');
  safe((m) => m.setKeepScreenOn(true));
}

export function callConnected(speaker: boolean) {
  safe((m) => { m.stopRingback(); m.setForceSpeakerphoneOn(speaker); });
}

export function callSpeaker(on: boolean) {
  safe((m) => m.setForceSpeakerphoneOn(on));
}

export function callEnd() {
  if (!callOn) return;
  callOn = false;
  safe((m) => m.stopRingback());
  if (liveOn > 0) {
    // Back to live voice on the speaker.
    safe((m) => m.setForceSpeakerphoneOn(true));
    return;
  }
  maybeStop();
}

// ── Ringing for an incoming call ──

export function ringStart(): boolean {
  const m = icm();
  if (!m) return false;
  try {
    m.startRingtone('_DEFAULT_', [0, 1000, 800], 'playback', 45);
    return true;
  } catch {
    return false;
  }
}

export function ringStop() {
  safe((m) => m.stopRingtone());
}

// ── Live voice on posts and in Spot rooms ──

/** Live voice is connected: loudspeaker on. Returns a release function. */
export function liveAudioStart(): () => void {
  liveOn += 1;
  if (!callOn) {
    ensureStarted('video'); // "video" mode: no proximity sensor, speaker by default
    safe((m) => m.setForceSpeakerphoneOn(true));
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    liveOn = Math.max(0, liveOn - 1);
    maybeStop();
  };
}
