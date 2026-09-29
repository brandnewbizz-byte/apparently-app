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
 * Audio is recorded in short bounded segments (a complete WAV each) so every
 * broadcast message stays well under the Supabase Realtime payload limit
 * (256 KB free / 3 MB Pro). Each segment is independently playable.
 *
 * Uses expo-av for recording (Audio.Recording) and playback (Audio.Sound).
 * Audio format: PCM 16-bit 16000 Hz mono, base64-encoded (~2s segments).
 */

import type { Audio as AudioTypes } from 'expo-av';
import { SafeAudio as Audio } from '@/lib/safe-av';
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

const RECORDING_OPTIONS: AudioTypes.RecordingOptions = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

// A ~2s segment at 16 kHz 16-bit mono is ~64 KB raw (~85 KB base64) — safely
// under the 256 KB Realtime broadcast limit and independently playable.
const SEGMENT_MS = 2000;

// ── Factory ──

export function createAudioRelayClient(config: AudioRelayConfig): AudioRelayClient {
  const { roomId, peerId, peerName, onPeersUpdated, onSpeakerStart, onSpeakerStop, onModerationMute } = config;
  const requestMicOnConnect = config.requestMicOnConnect !== false;

  let channel: RealtimeChannel | null = null;
  let connected = false;
  let recording: AudioTypes.Recording | null = null;
  let isRecording = false;
  let segmentTimer: ReturnType<typeof setInterval> | null = null;
  let chunkSequence = 0;
  let selfMuted = false;
  let micGranted = false;

  // Speaker playback pool: one Audio.Sound per remote peer
  const speakerPool = new Map<string, { sound: AudioTypes.Sound; peerName: string; lastChunkAt: number }>();
  const speakers: RemoteSpeaker[] = [];

  // ── Permission ──

  async function ensurePermissions() {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');
    micGranted = true;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }

  // ── Read a recording file as base64 ──
  //
  // NOTE: the old implementation used `fetch(uri)` + `FileReader`, which is
  // unavailable in React Native and would have thrown at runtime on device.
  // We use the expo-file-system `File` class (SDK 57) instead.

  async function readRecordingBase64(rec: AudioTypes.Recording): Promise<string> {
    const uri = rec.getURI();
    if (!uri) return '';
    const { File } = await import('expo-file-system');
    return new File(uri).base64();
  }

  // ── Playback for incoming audio ──

  async function playIncomingAudio(fromPeerId: string, fromPeerName: string, base64Data: string) {
    try {
      let entry = speakerPool.get(fromPeerId);

      if (!entry) {
        // Initialize a playback sound for this peer
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${base64Data}` },
          { shouldPlay: true, volume: 1.0, rate: 1.0 }
        );
        entry = { sound, peerName: fromPeerName, lastChunkAt: Date.now() };
        speakerPool.set(fromPeerId, entry);

        // Track as speaking
        updateSpeaker(fromPeerId, fromPeerName, true);
        onSpeakerStart?.(fromPeerId, fromPeerName);
      } else {
        // Reload with new chunk for continuous playback
        entry.lastChunkAt = Date.now();
        try {
          await entry.sound.unloadAsync();
        } catch {}
        await entry.sound.loadAsync(
          { uri: `data:audio/wav;base64,${base64Data}` },
          { shouldPlay: true, volume: 1.0 }
        );
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
          try { entry.sound.unloadAsync(); } catch {}
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
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
    // Unload all speaker sounds
    for (const [, entry] of speakerPool) {
      try { entry.sound.unloadAsync(); } catch {}
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
    const rec = new Audio.Recording();
    recording = rec;
    await rec.prepareToRecordAsync(RECORDING_OPTIONS);
    await rec.startAsync();
    isRecording = true;
  }

  async function sendCurrentSegment() {
    if (!recording) return;
    const rec = recording;
    recording = null;
    isRecording = false;
    try {
      const base64 = await readRecordingBase64(rec);
      await rec.stopAndUnloadAsync();
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
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
