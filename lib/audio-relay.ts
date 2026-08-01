/**
 * AudioRelayClient — WebSocket client for push-to-talk audio streaming.
 *
 * Connects to the signaling server at /ws/room and handles:
 *  - Room join/leave with peer discovery
 *  - Push-to-talk: hold mic → stream audio chunks → release mutes
 *  - Multi-speaker: receives audio from any number of simultaneous speakers
 *  - Moderation: host mute/unmute commands from the server
 *
 * Uses expo-av for recording (Audio.Recording) and playback (Audio.Sound).
 * Audio format: PCM 16-bit 16000 Hz mono, base64-encoded chunks (~40ms each).
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// ── Types ──

export interface RemoteSpeaker {
  peerId: string;
  peerName: string;
  isSpeaking: boolean;
  lastChunkAt: number;
}

export interface AudioRelayConfig {
  serverUrl: string;
  roomId: string;
  peerId: string;
  peerName: string;
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

const RECORDING_OPTIONS: Audio.RecordingOptions = {
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

// ── Factory ──

export function createAudioRelayClient(config: AudioRelayConfig): AudioRelayClient {
  const { serverUrl, roomId, peerId, peerName, onPeersUpdated, onSpeakerStart, onSpeakerStop, onModerationMute } = config;

  let ws: WebSocket | null = null;
  let connected = false;
  let recording: Audio.Recording | null = null;
  let isRecording = false;
  let chunkInterval: ReturnType<typeof setInterval> | null = null;
  let chuckSequence = 0;

  // Speaker playback pool: one Audio.Sound per remote peer
  const speakerPool = new Map<string, { sound: Audio.Sound; peerName: string; lastChunkAt: number }>();
  const speakers: RemoteSpeaker[] = [];

  // ── Permission ──

  async function ensurePermissions() {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
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

      for (const [peerId, entry] of speakerPool) {
        if (now - entry.lastChunkAt > stale) {
          updateSpeaker(peerId, entry.peerName, false);
          speakerPool.delete(peerId);
          try { entry.sound.unloadAsync(); } catch {}
        }
      }
    }, 1000);
  }

  // ── Connect ──

  async function connect() {
    await ensurePermissions();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    return new Promise<void>((resolve, reject) => {
      try {
        ws = new WebSocket(`${serverUrl}/ws/room`);

        ws.onopen = () => {
          connected = true;
          // Join the room
          ws!.send(JSON.stringify({
            type: 'join',
            roomId,
            peerId,
            peerName,
          }));
          startSilenceCheck();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'join':
                // Our join confirmed — received ICE servers + existing peers
                break;

              case 'peer_joined':
                break;

              case 'peer_left':
                // Remove from pool
                updateSpeaker(msg.peerId, msg.peerName, false);
                const entry = speakerPool.get(msg.peerId);
                if (entry) {
                  try { entry.sound.unloadAsync(); } catch {}
                  speakerPool.delete(msg.peerId);
                }
                break;

              case 'audio_chunk':
                // Play audio from remote speaker
                if (msg.audioData && msg.peerId && msg.peerName) {
                  playIncomingAudio(msg.peerId, msg.peerName, msg.audioData);
                }
                break;

              case 'mute':
                onModerationMute?.(true);
                break;

              case 'unmute':
                onModerationMute?.(false);
                break;

              case 'error':
                console.warn('[AudioRelay] Server error:', msg.error);
                break;
            }
          } catch (e) {
            console.warn('[AudioRelay] Parse error:', e);
          }
        };

        ws.onerror = (e) => {
          console.warn('[AudioRelay] WS error:', e);
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          connected = false;
          cleanup();
        };

        // Timeout fallback
        setTimeout(() => {
          if (!connected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      } catch (e) {
        reject(e);
      }
    });
  }

  function cleanup() {
    if (silenceCheck) { clearInterval(silenceCheck); silenceCheck = null; }
    if (chunkInterval) { clearInterval(chunkInterval); chunkInterval = null; }
    // Unload all speaker sounds
    for (const [, entry] of speakerPool) {
      try { entry.sound.unloadAsync(); } catch {}
    }
    speakerPool.clear();
    speakers.length = 0;
    onPeersUpdated?.([]);
  }

  function disconnect() {
    if (ws && connected) {
      ws.send(JSON.stringify({ type: 'leave', roomId, peerId }));
      ws.close();
    }
    connected = false;
    cleanup();
  }

  // ── Push-to-talk: start ──

  async function startSpeaking() {
    if (!connected) return;

    try {
      // Ensure fresh audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      isRecording = true;

      // Notify server
      ws!.send(JSON.stringify({ type: 'unmute', roomId, peerId }));

      // Chunk audio every ~100ms
      chunkInterval = setInterval(async () => {
        if (!recording || !isRecording || !connected) return;

        try {
          const uri = recording.getURI();
          if (!uri) return;

          // Read the file as base64
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            if (base64 && connected) {
              ws!.send(JSON.stringify({
                type: 'audio_chunk',
                roomId,
                peerId,
                audioData: base64,
                sequence: chuckSequence++,
              }));
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          // Skip chunk on error
        }
      }, 100);
    } catch (e) {
      console.warn('[AudioRelay] Recording start failed:', e);
    }
  }

  // ── Push-to-talk: stop ──

  function stopSpeaking() {
    if (chunkInterval) { clearInterval(chunkInterval); chunkInterval = null; }

    if (recording && isRecording) {
      try {
        recording.stopAndUnloadAsync();
      } catch {}
      recording = null;
      isRecording = false;
    }

    if (connected) {
      ws!.send(JSON.stringify({ type: 'mute', roomId, peerId }));
    }
  }

  function isConnected() { return connected; }
  function getSpeakers() { return [...speakers]; }

  function muteSelf(muted: boolean) {
    if (muted && isRecording) stopSpeaking();
    if (connected) {
      ws!.send(JSON.stringify({ type: muted ? 'mute' : 'unmute', roomId, peerId }));
    }
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
