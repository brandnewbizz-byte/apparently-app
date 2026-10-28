/**
 * usePostVoiceRoom — Listen / Talk / Mute voice for a single post.
 *
 * Wraps `createAudioRelayClient` with a `post-${postId}` room identity and a
 * listen-only connection model. Listen connects WITHOUT mic permission; Talk
 * requests permission and starts publishing. Every teardown path (scroll-away,
 * unmount, background, network error) fully disconnects so audio can never
 * leak across posts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAudioRecorder } from 'expo-audio';
import { createAudioRelayClient, RELAY_RECORDING_OPTIONS, type AudioRelayClient, type RemoteSpeaker } from '@/lib/audio-relay';

export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UsePostVoiceRoomOptions {
  postId: string | null;
  userId: string;
  userName: string;
  enabled?: boolean;
}

export interface UsePostVoiceRoomResult {
  connectionState: VoiceConnectionState;
  isListening: boolean;
  isMicActive: boolean;
  isMuted: boolean;
  speakers: RemoteSpeaker[];
  /** Peer ids currently emitting audio (for speaking rings). */
  speakingIds: string[];
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  startTalking: () => Promise<void>;
  stopTalking: () => void;
  toggleMute: () => void;
}

export function usePostVoiceRoom(options: UsePostVoiceRoomOptions): UsePostVoiceRoomResult {
  const { postId, userId, userName, enabled = true } = options;
  const roomId = postId ? `post-${postId}` : '';
  // One recorder per post layer, created the same way as voice notes.
  const recorder = useAudioRecorder(RELAY_RECORDING_OPTIONS);

  const clientRef = useRef<AudioRelayClient | null>(null);
  const autoJoinedRef = useRef<string>('');
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('disconnected');
  const [isListening, setIsListening] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakers, setSpeakers] = useState<RemoteSpeaker[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Reset + teardown whenever the post changes ──
  useEffect(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsListening(false);
    setIsMicActive(false);
    setIsMuted(false);
    setSpeakers([]);
    setError(null);
    setConnectionState('disconnected');
    autoJoinedRef.current = '';
  }, [postId]);

  // ── Final cleanup on unmount ──
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  // ── App backgrounding → leave the voice room completely ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        clientRef.current?.stopSpeaking();
        clientRef.current?.disconnect();
        clientRef.current = null;
        setIsListening(false);
        setIsMicActive(false);
        setIsMuted(false);
        setSpeakers([]);
        setConnectionState('disconnected');
      }
    });
    return () => sub.remove();
  }, []);

  // ── Lazily create the client (no connection for passive viewing) ──
  const getClient = useCallback((): AudioRelayClient | null => {
    if (!enabled || !roomId || !userId) return null;
    if (!clientRef.current) {
      clientRef.current = createAudioRelayClient({
        roomId,
        peerId: userId,
        peerName: userName || 'User',
        requestMicOnConnect: false,
        recorder,
        onPeersUpdated: (peers) => setSpeakers(peers),
      });
    }
    return clientRef.current;
  }, [enabled, roomId, userId, userName, recorder]);

  // ── Listen (no mic) ──
  const startListening = useCallback(async () => {
    const client = getClient();
    if (!client) return;
    setError(null);
    try {
      setConnectionState('connecting');
      await client.connect();
      setConnectionState('connected');
      setIsListening(true);
    } catch (e) {
      setConnectionState('error');
      setError(e instanceof Error && e.message ? e.message : 'Voice connection failed');
      setIsListening(false);
    }
  }, [getClient]);

  const stopListening = useCallback(() => {
    clientRef.current?.stopSpeaking();
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsListening(false);
    setIsMicActive(false);
    setIsMuted(false);
    setSpeakers([]);
    setConnectionState('disconnected');
  }, []);

  // ── Auto-join: every post is a live room ──
  // The moment a post becomes the active post, join its voice room as a
  // listener automatically (no tap required) — so "every post is live" and
  // Talk is the only explicit action. Once the user leaves a post's room,
  // we don't re-join until the post changes.
  useEffect(() => {
    if (!enabled || !postId || !userId) return;
    if (autoJoinedRef.current === postId) return;
    autoJoinedRef.current = postId;
    startListening().catch(() => {});
  }, [enabled, postId, userId, startListening]);

  // ── Talk (explicit mic) ──
  const startTalking = useCallback(async () => {
    const client = getClient();
    if (!client) return;
    setError(null);
    try {
      if (!client.isConnected()) {
        setConnectionState('connecting');
        await client.connect();
        setConnectionState('connected');
      }
      // Talking implies you're also in the room listening.
      setIsListening(true);
      await client.startSpeaking(); // requests mic permission if needed
      setIsMicActive(true);
      setIsMuted(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Microphone unavailable');
      setIsMicActive(false);
    }
  }, [getClient]);

  const stopTalking = useCallback(() => {
    clientRef.current?.stopSpeaking();
    setIsMicActive(false);
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const next = !isMuted;
    client.muteSelf(next);
    setIsMuted(next);
    if (!next) {
      // Un-muting → resume publishing.
      client.startSpeaking().catch(() => {});
    }
  }, [isMuted]);

  const speakingIds = useMemo(
    () => speakers.filter((s) => s.isSpeaking).map((s) => s.peerId),
    [speakers]
  );

  return {
    connectionState,
    isListening,
    isMicActive,
    isMuted,
    speakers,
    speakingIds,
    error,
    startListening,
    stopListening,
    startTalking,
    stopTalking,
    toggleMute,
  };
}
