/**
 * usePostVoiceRoom — hold-to-talk voice on a feed post.
 *
 * Uses the same engine as Spot rooms (hooks/useSpotVoice): while you hold the
 * mic, short clips are recorded and sent over a live channel; everyone on the
 * post hears each clip queued back to back, so nothing is cut off or skipped.
 * (The old version replaced the playing clip with every new one and reused one
 * file, which is why people heard choppy, broken audio.)
 *
 * Listening starts automatically when the post is on screen. The speaker
 * button turns incoming sound off and on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useSpotVoice } from '@/hooks/useSpotVoice';

export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UsePostVoiceRoomOptions {
  postId: string | null;
  userId: string;
  userName: string;
  enabled?: boolean;
}

export interface UsePostVoiceRoomResult {
  connectionState: VoiceConnectionState;
  /** Incoming sound on. */
  soundOn: boolean;
  /** You are holding the mic. */
  talking: boolean;
  /** Ids of people talking right now. */
  speakingIds: string[];
  error: string | null;
  toggleSound: () => void;
  /** Press the mic. Resolves 'denied' when the mic isn't allowed. */
  startTalking: () => Promise<'ok' | 'denied' | 'failed'>;
  /** Let go of the mic. */
  stopTalking: () => void;
}

type Handler = (payload: any) => void;

export function usePostVoiceRoom({ postId, userId, userName, enabled = true }: UsePostVoiceRoomOptions): UsePostVoiceRoomResult {
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('disconnected');
  const [soundOn, setSoundOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const soundOnRef = useRef(true);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlers = useRef<Record<string, Set<Handler>>>({});

  // A tiny "room" adapter over a Supabase broadcast channel, shaped the way
  // useSpotVoice expects. It stays the same object for the life of the hook.
  const room = useMemo(() => ({
    send: (event: string, payload: any) => {
      channelRef.current?.send({ type: 'broadcast', event, payload }).then(() => {}, () => {});
    },
    on: (event: string, fn: Handler) => {
      (handlers.current[event] ||= new Set()).add(fn);
      return () => { handlers.current[event]?.delete(fn); };
    },
  }), []);

  const me = useMemo(() => (userId ? { id: userId, name: userName || 'User' } : null), [userId, userName]);
  const { talking, speaking, startTalking: spotStart, stopTalking } = useSpotVoice(room, me);

  // ── Join this post's voice channel while it's on screen ──
  useEffect(() => {
    if (!enabled || !postId || !userId) return;
    setError(null);
    setConnectionState('connecting');
    // Play through the loudspeaker, even with the silent switch on.
    if (Platform.OS !== 'web') {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});
    }
    const ch = supabase.channel(`post-voice:${postId}`, { config: { broadcast: { self: false } } });
    const dispatch = (event: string) => ({ payload }: any) => {
      if (event === 'voice' && !soundOnRef.current) return; // sound off: drop clips
      handlers.current[event]?.forEach((fn) => { try { fn(payload); } catch {} });
    };
    ch.on('broadcast', { event: 'voice' }, dispatch('voice'));
    ch.on('broadcast', { event: 'talk' }, dispatch('talk'));
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') setConnectionState('connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionState('error');
        setError('Live voice is unavailable right now');
      }
    });
    channelRef.current = ch;
    return () => {
      stopTalking();
      channelRef.current = null;
      supabase.removeChannel(ch).then(() => {}, () => {});
      setConnectionState('disconnected');
    };
  }, [enabled, postId, userId, stopTalking]);

  // Going to the background lets go of the mic.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') stopTalking(); });
    return () => sub.remove();
  }, [stopTalking]);

  const toggleSound = useCallback(() => setSoundOn((v) => !v), []);

  const startTalking = useCallback(async () => {
    if (connectionState !== 'connected') return 'failed' as const;
    setError(null);
    const r = await spotStart();
    if (r === 'denied') setError('Allow microphone access in Settings to talk');
    else if (r === 'failed') setError('Couldn’t start the mic. Try again.');
    return r;
  }, [connectionState, spotStart]);

  const speakingIds = useMemo(() => Object.keys(speaking), [speaking]);

  return { connectionState, soundOn, talking, speakingIds, error, toggleSound, startTalking, stopTalking };
}
