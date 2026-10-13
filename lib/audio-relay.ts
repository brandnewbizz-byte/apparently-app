/**
 * AudioRelayClient — push-to-talk audio streaming over Supabase Realtime.
 *
 * Replaces the old WebSocket signaling server with Supabase Realtime Broadcast.
 * The signaling server was just a thin JSON relay (join/leave, audio_chunk,
 * mute) — Supabase Realtime Broadcast already powers text chat and participant
 * presence in this app, so it can carry the same audio messages with no
 * additional backend to deploy.
 *
 * Push-to-talk: hold mic → record → stream audio segments → release mutes.
 * Audio is recorded in short bounded segments (a complete AAC/M4A each) so
 * every broadcast message stays well under the Supabase Realtime payload limit
 * (256 KB free / 3 MB Pro). Each segment is independently playable.
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
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
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
    bitsPerSecond: 64000,
  },
};

// A ~2s segment of AAC mono at 64 kbps is ~16 KB (~22 KB base64) — well under
// the 256 KB Realtime broadcast limit and independently playable.
const SEGMENT_MS = 2000;

// ── Factory ──

export function createAudioRelayClient(config: AudioRelayConfig): AudioRelayClient {
  const { roomId, peerId, peerName, onPeersUpdated, onSpeakerStart, onSpeakerStop, onModerationMute } = config;
  const requestMicOnConnect = config.requestMicOnConnect !== false;

  let channel: RealtimeChannel | null = null;
  let connected = false;
  let recording: AudioRecorder | null = null;
  let isRecording = false;
  let segmentTimer: ReturnType<typeof setInterval> | null = null;
  let chunkSequence = 0;
  let selfMuted = false;
  let micGranted = false;

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

    return new Promise<void>((resolve, reject) => {
      const ch = supabase.channel(`room-audio:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      ch.on('broadcast', { event: 'audio_chunk' }, ({ payload }: any) => {
        if (payload?.audioData && payload?.peerId && payload.peerId !== peerId) {
          playIncomingAudio(payload.peerId, payload.peerName || 'User', payload.audioData);
        }
      });

      ch.on('broadcast', { event: 'mute' }, ({ payload }: any) => {
        // Host moderation: a targeted mute for this peer
        if (payload?.targetPeerId === peerId) {
          onModerationMute?.(true);
        }
      });

      ch.on('broadcast', { event: 'unmute' }, ({ payload }: any) => {
        if (payload?.targetPeerId === peerId) {
          onModerationMute?.(false);
        }
      });

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          connected = true;
          startSilenceCheck();
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Realtime channel failed: ${status}`));
        }
      });

      channel = ch;

      // Timeout fallback
      setTimeout(() => {
        if (!connected) {
          reject(new Error('Realtime connection timeout'));
        }
      }, 10000);
    });
  }

  function cleanup() {
    if (silenceCheck) { clearInterval(silenceCheck); silenceCheck = null; }
    if (segmentTimer) { clearInterval(segmentTimer); segmentTimer = null; }
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
    if (channel) {
      supabase.removeChannel(channel).then(() => {}, () => {});
      channel = null;
    }
  }

  // ── Push-to-talk: start recording a segment ──

  async function startNewSegment() {
    const rec = new AudioModule.AudioRecorder(RECORDING_OPTIONS);
    recording = rec;
    await rec.prepareToRecordAsync();
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
        channel.send({
          type: 'broadcast',
          event: 'audio_chunk',
          payload: {
            roomId,
            peerId,
            peerName,
            audioData: base64,
            sequence: chunkSequence++,
          },
        }).then(() => {}, () => {});
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
      // broadcast stays bounded and the listener hears continuous audio.
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
