/**
 * AudioRelayClient — push-to-talk audio streaming over Supabase Realtime broadcast.
 *
 * (It used to relay clips through the `live_audio_chunks` table with REST
 * polling, but that table only allows the anon role, so signed-in users got
 * 403s and nobody ever heard anything. Clips now go over a broadcast channel,
 * the same way Spot rooms send voice.)
 *
 * Originally carried audio over Supabase Realtime Broadcast, but Realtime has
 * proven unreliable (platform-wide degradation + free-tier auto-pause). This
 * client now relays audio through the Postgres-backed `live_audio_chunks` table
 * using plain REST (PostgREST) — the most reliable Supabase service, with no
 * extra backend and no websocket dependency.
 *
 * Push-to-talk: hold mic → record → stream audio segments → release mutes.
 * Audio is recorded in short bounded segments (a complete AAC/M4A each) so each
 * row stays small and is independently playable. Talkers POST each segment to
 * `live_audio_chunks`; listeners poll every ~300ms and play any segment newer
 * than the last one they've seen. Added latency is ~0.3s on top of the ~2s
 * segment window — fine for a walkie-talkie "talk through this post" flow.
 *
 * Audio engine: `expo-audio` (the SDK 57 replacement for the deprecated and
 * removed `expo-av`). Recording uses `AudioModule.AudioRecorder` (imperative,
 * so it works outside a React hook); playback uses `createAudioPlayer`.
 * Incoming segments are written to a cache file (M4A/AAC) and played via a
 * per-peer `AudioPlayer` that is `replace()`d for continuous live playback.
 *
 * Audio format: AAC/M4A, 16 kHz, mono, ~64 kbps (~2s segments). AAC is
 * natively decodable on both iOS and Android, so segments are cross-platform.
 */

import {
  AudioModule,
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { AudioPlayer, AudioRecorder, RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ── Types ──

export interface RemoteSpeaker {
  peerId: string;
  peerName: string;
  isSpeaking: boolean;
  lastChunkAt: number;
}

export interface AudioRelayConfig {
  roomId: string;
  peerId: string;
  peerName: string;
  /**
   * When `false`, `connect()` does NOT request microphone permission and
   * configures audio for playback only (speaker output). This is used by the
   * Feed's "Listen" mode so tapping Listen never triggers a mic prompt.
   * Defaults to `true` to preserve the existing room behavior.
   */
  requestMicOnConnect?: boolean;
  onPeersUpdated?: (peers: RemoteSpeaker[]) => void;
  onSpeakerStart?: (peerId: string, peerName: string) => void;
  onSpeakerStop?: (peerId: string, peerName: string) => void;
  onModerationMute?: (muted: boolean) => void;
  /**
   * A recorder from expo-audio's `useAudioRecorder(RELAY_RELAY_RECORDING_OPTIONS)`.
   * Preferred: it's the same path voice notes use and works on every platform.
   */
  recorder?: AudioRecorder;
}

export interface AudioRelayClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  startSpeaking: () => Promise<void>;
  stopSpeaking: () => void;
  isConnected: () => boolean;
  getSpeakers: () => RemoteSpeaker[];
  muteSelf: (muted: boolean) => void;
}

// ── Audio session config ──

export const RELAY_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

// A ~2s segment of AAC mono at 64 kbps is ~16 KB (~22 KB base64) — well under
// PostgREST payload limits and independently playable.
const SEGMENT_MS = 2000;


// ── Factory ──

export function createAudioRelayClient(config: AudioRelayConfig): AudioRelayClient {
  const { roomId, peerId, peerName, onPeersUpdated, onSpeakerStart, onSpeakerStop, onModerationMute } = config;
  const requestMicOnConnect = config.requestMicOnConnect !== false;

  let connected = false;
  let recording: AudioRecorder | null = null;
  let isRecording = false;
  let segmentTimer: ReturnType<typeof setInterval> | null = null;
  let selfMuted = false;
  let micGranted = false;

  // Live channel for this room's audio clips.
  let channel: RealtimeChannel | null = null;

  // Speaker playback pool: one AudioPlayer per remote peer
  const speakerPool = new Map<string, { player: AudioPlayer; peerName: string; lastChunkAt: number }>();
  const speakers: RemoteSpeaker[] = [];

  // ── Permission ──

  async function ensurePermissions() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');
    micGranted = true;
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  }

  // ── Read a recording file as base64 ──
  //
  // Uses the expo-file-system `File` class (SDK 57) — `fetch(uri)`/`FileReader`
  // are unavailable in React Native and would have thrown at runtime on device.

  async function readRecordingBase64(uri: string): Promise<string> {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
    const { File } = await import('expo-file-system');
    return new File(uri).base64();
  }

  // ── Write incoming base64 audio to a cache file for playback ──
  //
  // `createAudioPlayer` expects an HTTPS URL, a local file path, or a static
  // resource name — native players (AVPlayer / ExoPlayer) do not decode
  // `data:` URIs. We materialize each incoming segment to a small cache file
  // and hand the file URI to the player.

  async function writeAudioToFile(targetPeerId: string, base64Data: string): Promise<string> {
    if (Platform.OS === 'web') return `data:audio/webm;base64,${base64Data}`;
    const { File, Directory, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.cache, 'live-audio');
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(dir, `live-${targetPeerId}.m4a`);
    if (file.exists) file.delete();
    file.create({ overwrite: true });
    file.write(base64Data, { encoding: 'base64' });
    return file.uri;
  }

  // ── Playback for incoming audio ──

  async function playIncomingAudio(fromPeerId: string, fromPeerName: string, base64Data: string) {
    try {
      const uri = await writeAudioToFile(fromPeerId, base64Data);
      let entry = speakerPool.get(fromPeerId);

      if (!entry) {
        // Initialize a playback player for this peer
        const player = createAudioPlayer(uri);
        player.volume = 1.0;
        player.play();
        entry = { player, peerName: fromPeerName, lastChunkAt: Date.now() };
        speakerPool.set(fromPeerId, entry);

        // Track as speaking
        updateSpeaker(fromPeerId, fromPeerName, true);
        onSpeakerStart?.(fromPeerId, fromPeerName);
      } else {
        // Swap in the new chunk for continuous playback
        entry.lastChunkAt = Date.now();
        entry.player.replace(uri);
        entry.player.play();
      }
    } catch (e) {
      // Audio playback error — peer may have unstable connection
      console.warn('[AudioRelay] Playback error:', e instanceof Error ? e.message : e);
    }
  }

  // ── Speaker tracking ──

  function updateSpeaker(peerId: string, peerName: string, speaking: boolean) {
    const existing = speakers.findIndex(s => s.peerId === peerId);
    if (speaking && existing === -1) {
      speakers.push({ peerId, peerName, isSpeaking: true, lastChunkAt: Date.now() });
    } else if (!speaking && existing !== -1) {
      speakers.splice(existing, 1);
      onSpeakerStop?.(peerId, peerName);
    } else if (speaking && existing !== -1) {
      speakers[existing].lastChunkAt = Date.now();
    }
    onPeersUpdated?.([...speakers]);
  }

  // ── Silence detection (cleanup stale speakers) ──

  let silenceCheck: ReturnType<typeof setInterval> | null = null;

  function startSilenceCheck() {
    silenceCheck = setInterval(() => {
      const now = Date.now();
      const stale = 2000; // 2 seconds without audio = stopped speaking

      for (const [pid, entry] of speakerPool) {
        if (now - entry.lastChunkAt > stale) {
          updateSpeaker(pid, entry.peerName, false);
          speakerPool.delete(pid);
          try { entry.player.remove(); } catch {}
        }
      }
    }, 1000);
  }

  // ── Broadcast transport ──

  async function joinChannel() {
    if (channel) return;
    const ch = supabase.channel(`voice:${roomId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'clip' }, ({ payload }) => {
      if (!connected || !payload?.b64 || payload.peerId === peerId) return;
      playIncomingAudio(payload.peerId, payload.peerName || 'User', payload.b64);
    });
    channel = ch;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Voice connection timed out')), 10000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); reject(new Error('Voice connection failed')); }
      });
    });
  }

  // ── Connect ──

  async function connect() {
    if (requestMicOnConnect) {
      await ensurePermissions();
    } else {
      // Listen-only: no mic permission, playback routed through the speaker.
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
    }

    connected = true;
    try {
      await joinChannel();
    } catch (e) {
      connected = false;
      if (channel) { supabase.removeChannel(channel); channel = null; }
      throw e;
    }
    startSilenceCheck();
  }

  function cleanup() {
    if (silenceCheck) { clearInterval(silenceCheck); silenceCheck = null; }
    if (segmentTimer) { clearInterval(segmentTimer); segmentTimer = null; }
    if (channel) { supabase.removeChannel(channel); channel = null; }
    // Remove all speaker players
    for (const [, entry] of speakerPool) {
      try { entry.player.remove(); } catch {}
    }
    speakerPool.clear();
    speakers.length = 0;
    onPeersUpdated?.([]);
  }

  function disconnect() {
    connected = false;
    cleanup();
  }

  // ── Push-to-talk: start recording a segment ──

  async function startNewSegment() {
    // expo-audio's `useAudioRecorder` passes FLAT, platform-resolved options
    // (via its internal `createRecordingOptions`) to the constructor. We can't
    // call that helper directly, but `prepareToRecordAsync(options)` is
    // monkey-patched to flatten a nested `RecordingOptions` for us. So we pass
    // an empty map to the constructor and hand the nested options to
    // `prepareToRecordAsync` — otherwise the native recorder never sees
    // `outputFormat`/`audioEncoder`/`audioQuality` and records in a mismatched
    // default container (which is why Talk silently produced no usable audio).
    const shared = config.recorder;
    const rec = shared ?? new AudioModule.AudioRecorder({});
    recording = rec;
    if (shared) await rec.prepareToRecordAsync();
    else await rec.prepareToRecordAsync(RELAY_RECORDING_OPTIONS);
    rec.record();
    isRecording = true;
  }

  async function sendCurrentSegment() {
    if (!recording) return;
    const rec = recording;
    recording = null;
    isRecording = false;
    try {
      await rec.stop();
      const uri = rec.uri;
      let base64 = '';
      if (uri) {
        base64 = await readRecordingBase64(uri);
      }
      if (base64 && connected && channel) {
        await channel.send({ type: 'broadcast', event: 'clip', payload: { peerId, peerName, b64: base64 } });
      }
    } catch (e) {
      console.warn('[AudioRelay] Segment send failed:', e instanceof Error ? e.message : e);
    }
  }

  async function startSpeaking() {
    if (!connected || selfMuted) return;

    try {
      // If this client connected in listen-only mode, request mic permission
      // now — microphone activation always stems from the explicit Talk action.
      if (!micGranted) {
        await ensurePermissions();
      }
      // Ensure fresh audio mode
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      await startNewSegment();

      // Rotate segments: send the current clip, start a fresh one, so each
      // insert stays bounded and the listener hears continuous audio.
      segmentTimer = setInterval(async () => {
        if (!connected) return;
        await sendCurrentSegment();
        if (connected && !selfMuted) {
          try { await startNewSegment(); } catch {}
        }
      }, SEGMENT_MS);
    } catch (e) {
      console.warn('[AudioRelay] Recording start failed:', e instanceof Error ? e.message : e);
    }
  }

  // ── Push-to-talk: stop ──

  function stopSpeaking() {
    if (segmentTimer) { clearInterval(segmentTimer); segmentTimer = null; }
    sendCurrentSegment().catch(() => {});
  }

  function isConnected() { return connected; }
  function getSpeakers() { return [...speakers]; }

  function muteSelf(muted: boolean) {
    selfMuted = muted;
    if (muted) stopSpeaking();
  }

  return {
    connect,
    disconnect,
    startSpeaking,
    stopSpeaking,
    isConnected,
    getSpeakers,
    muteSelf,
  };
}
