import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { parseClip } from '@/lib/videoClip';

/**
 * Video player built on expo-video. expo-av was removed in Expo SDK 58, so
 * this replaces its <Video> while keeping the same props the app used.
 *
 * Trimmed videos (lib/videoClip: "…mp4#t=3,14&fit=contain") play only the
 * trimmed part, and a "fit" choice made when posting wins over `resizeMode`.
 */
export interface AppVideoProps {
  source: { uri?: string | null } | null | undefined;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'fill';
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  useNativeControls?: boolean;
}

export default function AppVideo({
  source,
  style,
  resizeMode = 'cover',
  shouldPlay = false,
  isLooping = false,
  isMuted = false,
  useNativeControls = false,
}: AppVideoProps) {
  const { src: uri, clip } = parseClip(source?.uri || null);
  const start = clip.start || 0;
  const end = clip.end || 0;
  const trimmed = start > 0 || end > 0;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = isLooping && !trimmed;
    p.muted = isMuted;
    if (trimmed) {
      p.timeUpdateEventInterval = 0.1;
      if (start > 0) p.currentTime = start;
    }
    if (shouldPlay) p.play();
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = isLooping && !trimmed;
      player.muted = isMuted;
      if (shouldPlay) player.play();
      else player.pause();
    } catch {
      // player may already be released during unmount
    }
  }, [player, isLooping, isMuted, shouldPlay, trimmed]);

  // Keep playback inside the trimmed part.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!trimmed) return;
    try {
      if (end > 0 && currentTime >= end) {
        if (isLooping) player.currentTime = start;
        else player.pause();
      } else if (start > 0 && currentTime < start - 0.5) {
        player.currentTime = start;
      }
    } catch {}
  });
  useEventListener(player, 'playToEnd', () => {
    if (!trimmed || !isLooping) return;
    try { player.currentTime = start; player.play(); } catch {}
  });

  if (!uri) return null;
  const fit = clip.fit && resizeMode !== 'fill' ? clip.fit : resizeMode;
  return (
    <VideoView
      player={player}
      style={style}
      contentFit={fit}
      nativeControls={useNativeControls}
    />
  );
}
