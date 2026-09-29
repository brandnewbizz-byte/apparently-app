/**
 * usePostPresence — realtime viewer presence for a single post.
 *
 * One Supabase Realtime Presence channel per post (`post-presence:${postId}`).
 * Merely having the post active tracks the user as "here now"; the `isTalking`
 * flag (bridged from the voice hook) is re-tracked live so other viewers see
 * "N here now · M talking" without subscribing to the audio broadcast.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PostPresenceParticipant {
  userId: string;
  userName: string;
  avatar: string | null;
  isTalking: boolean;
  lastActive: string;
}

interface UsePostPresenceOptions {
  postId: string | null;
  userId: string;
  userName: string;
  avatar: string | null;
  enabled?: boolean;
  /** Whether THIS user currently has their microphone on (unmuted). */
  isTalking?: boolean;
}

export interface UsePostPresenceResult {
  isConnected: boolean;
  participants: PostPresenceParticipant[];
  presenceCount: number;
  talkingCount: number;
}

export function usePostPresence(options: UsePostPresenceOptions): UsePostPresenceResult {
  const { postId, userId, userName, avatar, enabled = true, isTalking = false } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<PostPresenceParticipant[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackedRef = useRef(false);
  const isTalkingRef = useRef(isTalking);
  isTalkingRef.current = isTalking;

  // ── Subscribe + track presence for the active post ──
  useEffect(() => {
    if (!enabled || !postId || !userId) {
      setIsConnected(false);
      setParticipants([]);
      return;
    }

    const channel = supabase.channel(`post-presence:${postId}`, {
      config: { presence: { key: userId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const presences: PostPresenceParticipant[] = [];
      for (const key of Object.keys(state)) {
        const entries = state[key] as any[];
        if (entries && entries.length > 0) {
          presences.push(entries[0] as PostPresenceParticipant);
        }
      }
      setParticipants(presences);
    });

    channel.subscribe(async (status) => {
      setIsConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED' && !trackedRef.current) {
        trackedRef.current = true;
        await channel.track({
          userId,
          userName,
          avatar,
          isTalking: isTalkingRef.current,
          lastActive: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      trackedRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
      setParticipants([]);
    };
  }, [postId, userId, enabled]);

  // ── Re-track when our talking flag changes so others see "M talking" live ──
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !trackedRef.current) return;
    channel.track({
      userId,
      userName,
      avatar,
      isTalking,
      lastActive: new Date().toISOString(),
    });
  }, [isTalking, userId, userName, avatar]);

  const presenceCount = participants.length;
  const talkingCount = participants.filter((p) => p.isTalking).length;

  return { isConnected, participants, presenceCount, talkingCount };
}
