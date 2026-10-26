import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * Video player built on expo-video. expo-av was removed in Expo SDK 58, so
 * this replaces its <Video> while keeping the same props the app used.
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
  const uri = source?.uri || null;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = isLooping;
    p.muted = isMuted;
    if (shouldPlay) p.play();
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = isLooping;
      player.muted = isMuted;
      if (shouldPlay) player.play();
      else player.pause();
    } catch {
      // player may already be released during unmount
    }
  }, [player, isLooping, isMuted, shouldPlay]);

  if (!uri) return null;
  return (
    <VideoView
      player={player}
      style={style}
      contentFit={resizeMode}
      nativeControls={useNativeControls}
    />
  );
}
