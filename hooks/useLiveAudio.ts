/**
 * useLiveAudio — React hook for push-to-talk audio in live rooms.
 *
 * Wraps AudioRelayClient with React state management and RoomContext integration.
 * Audio now streams over Supabase Realtime Broadcast — no signaling backend
 * required.
 *
 * Usage in room screen:
 *   const audio = useLiveAudio(roomId);
 *   // Mic button: onPressIn={audio.startSpeaking} onPressOut={audio.stopSpeaking}
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createAudioRelayClient, type AudioRelayClient, type RemoteSpeaker } from '@/lib/audio-relay';

interface UseLiveAudioOptions {
  roomId: string;
  peerId: string;
  peerName: string;
  enabled?: boolean;
  onMutedByHost?: () => void;
}

interface UseLiveAudioResult {
  // State
  isConnected: boolean;
  isMicActive: boolean;
  speakers: RemoteSpeaker[];
  speakingCount: number;

  // Actions
  joinRoom: () => Promise<void>;
  leaveRoom: () => void;
  startSpeaking: () => Promise<void>;
  stopSpeaking: () => void;
  muteSelf: (muted: boolean) => void;

  // For mic button UI: hold-to-talk
  micPressIn: () => Promise<void>;
  micPressOut: () => void;
}

export function useLiveAudio(options: UseLiveAudioOptions): UseLiveAudioResult {
  const { roomId, peerId, peerName, enabled = true, onMutedByHost } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [speakers, setSpeakers] = useState<RemoteSpeaker[]>([]);

  const clientRef = useRef<AudioRelayClient | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  // ── Initialize client ──

  useEffect(() => {
    if (!enabled || !roomId || !peerId) return;

    const client = createAudioRelayClient({
      roomId,
      peerId,
      peerName,
      onPeersUpdated: (peers) => setSpeakers(peers),
      onSpeakerStart: (_peerId) => {
        // Speaker already tracked via onPeersUpdated
      },
      onSpeakerStop: (_peerId) => {
        // Clean up handled automatically
      },
      onModerationMute: (muted) => {
        if (muted) {
          setIsMicActive(false);
          onMutedByHost?.();
        }
      },
    });

    clientRef.current = client;
    cleanupRef.current = () => {
      client.disconnect();
      setIsConnected(false);
      setIsMicActive(false);
      setSpeakers([]);
    };

    return () => {
      client.disconnect();
      setIsConnected(false);
    };
  }, [roomId, peerId, peerName, enabled]);

  // ── Join/leave ──

  const joinRoom = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.connect();
      setIsConnected(true);
    } catch (e) {
      console.warn('[useLiveAudio] Connect failed:', e);
    }
  }, []);

  const leaveRoom = useCallback(() => {
    cleanupRef.current();
    setIsConnected(false);
  }, []);

  // ── Speak ──

  const startSpeaking = useCallback(async () => {
    if (!clientRef.current || !isConnected) return;
    try {
      await clientRef.current.startSpeaking();
      setIsMicActive(true);
    } catch {
      // Failed to start speaking
    }
  }, [isConnected]);

  const stopSpeaking = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.stopSpeaking();
    setIsMicActive(false);
  }, []);

  const muteSelf = useCallback((muted: boolean) => {
    if (!clientRef.current) return;
    clientRef.current.muteSelf(muted);
    if (muted) setIsMicActive(false);
  }, []);

  // ── Mic button: hold-to-talk ──

  const micPressIn = useCallback(async () => {
    await startSpeaking();
  }, [startSpeaking]);

  const micPressOut = useCallback(() => {
    stopSpeaking();
  }, [stopSpeaking]);

  const speakingCount = speakers.filter(s => s.isSpeaking).length;

  return {
    isConnected,
    isMicActive,
    speakers,
    speakingCount,
    joinRoom,
    leaveRoom,
    startSpeaking,
    stopSpeaking,
    muteSelf,
    micPressIn,
    micPressOut,
  };
}
