/**
 * usePostVoiceRoom — live voice on a feed post.
 *
 * Press and hold the mic to go live: your mic turns on and STAYS on (you can
 * let go and keep talking). While live, a mic-mute button pauses your mic and
 * an end button goes off-air. Uses the same clip engine as Spot rooms
 * (hooks/useSpotVoice), so listeners hear clips back to back, never cut off.
 *
 * Listening starts by itself when a post is on screen. The speaker switch is
 * shared by every post (lib/liveSound): mute once and it stays muted while you
 * scroll, until you unmute.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useSpotVoice } from '@/hooks/useSpotVoice';
import { useLiveSound } from '@/lib/liveSound';

export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Longest single live stretch before the mic turns itself off. */
const MAX_LIVE_MS = 15 * 60_000;

interface UsePostVoiceRoomOptions {
  postId: string | null;
  userId: string;
  userName: string;
  enabled?: boolean;
}

export interface UsePostVoiceRoomResult {
  connectionState: VoiceConnectionState;
  /** Other people's voices on (shared by every post). */
  soundOn: boolean;
  /** You're live on this post (mic may be muted). */
  live: boolean;
  /** Your mic is muted while live. */
  micMuted: boolean;
  /** Your voice is going out right now. */
  talking: boolean;
  speakingIds: string[];
  error: string | null;
  toggleSound: () => void;
  goLive: () => Promise<'ok' | 'denied' | 'failed'>;
  endLive: () => void;
  toggleMic: () => void;
}

type Handler = (payload: any) => void;

export function usePostVoiceRoom({ postId, userId, userName, enabled = true }: UsePostVoiceRoomOptions): UsePostVoiceRoomResult {
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('disconnected');
  const [soundOn, setSoundOn] = useLiveSound();
  const [live, setLive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlers = useRef<Record<string, Set<Handler>>>({});

  // A tiny "room" over a Supabase broadcast channel, the shape useSpotVoice expects.
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
  const { talking, speaking, startTalking, stopTalking } = useSpotVoice(room, me, { maxTalkMs: MAX_LIVE_MS });

  // ── Join this post's voice channel while it's on screen ──
  useEffect(() => {
    if (!enabled || !postId || !userId) return;
    setError(null);
    setConnectionState('connecting');
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
      setLive(false);
      setMicMuted(false);
      channelRef.current = null;
      supabase.removeChannel(ch).then(() => {}, () => {});
      setConnectionState('disconnected');
    };
  }, [enabled, postId, userId, stopTalking]);

  // Leaving the app ends your live mic.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') { stopTalking(); setLive(false); setMicMuted(false); }
    });
    return () => sub.remove();
  }, [stopTalking]);

  // The mic loop stopped by itself (time limit / error) while not muted → off-air.
  const wasTalking = useRef(false);
  useEffect(() => {
    if (wasTalking.current && !talking && live && !micMuted) setLive(false);
    wasTalking.current = talking;
  }, [talking, live, micMuted]);

  const toggleSound = useCallback(() => setSoundOn(!soundOnRef.current), [setSoundOn]);

  const goLive = useCallback(async () => {
    if (connectionState !== 'connected') return 'failed' as const;
    setError(null);
    const r = await startTalking();
    if (r === 'ok') { setLive(true); setMicMuted(false); }
    else if (r === 'denied') setError('Allow microphone access in Settings to talk');
    else setError('Couldn’t start the mic. Try again.');
    return r;
  }, [connectionState, startTalking]);

  const endLive = useCallback(() => {
    stopTalking();
    setLive(false);
    setMicMuted(false);
  }, [stopTalking]);

  const toggleMic = useCallback(() => {
    if (!live) return;
    if (micMuted) {
      setMicMuted(false);
      startTalking().then((r) => { if (r !== 'ok') { setLive(false); setError('Couldn’t turn the mic back on.'); } });
    } else {
      setMicMuted(true);
      stopTalking();
    }
  }, [live, micMuted, startTalking, stopTalking]);

  const speakingIds = useMemo(() => Object.keys(speaking), [speaking]);

  return { connectionState, soundOn, live, micMuted, talking, speakingIds, error, toggleSound, goLive, endLive, toggleMic };
}
