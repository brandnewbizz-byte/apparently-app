import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
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
  /** Thin Instagram-style progress line along the bottom. */
  showProgress?: boolean;
  /** Extra space under the progress line (e.g. a floating tab bar). */
  progressBottom?: number;
}

export default function AppVideo({
  source,
  style,
  resizeMode = 'cover',
  shouldPlay = false,
  isLooping = false,
  isMuted = false,
  useNativeControls = false,
  showProgress = false,
  progressBottom = 0,
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
    } else if (showProgress) {
      p.timeUpdateEventInterval = 0.25;
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

  const [progress, setProgress] = useState(0);

  // Keep playback inside the trimmed part.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (showProgress) {
      try {
        const total = (end > 0 ? end : player.duration || 0) - start;
        if (total > 0) setProgress(Math.max(0, Math.min(1, (currentTime - start) / total)));
      } catch {}
    }
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
  const view = (
    <VideoView
      player={player}
      style={showProgress ? StyleSheet.absoluteFill : style}
      contentFit={fit}
      nativeControls={useNativeControls}
    />
  );
  if (!showProgress) return view;
  return (
    <View style={style}>
      {view}
      <View pointerEvents="none" style={[styles.track, { bottom: progressBottom }]}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

/**
 * The big play / pause icon that pops in the middle of a video when you tap
 * it (Instagram). While paused the play icon stays on screen.
 */
export function PlayPauseFlash({ paused }: { paused: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  const [icon, setIcon] = useState<'play' | 'pause'>('pause');
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (paused) {
      setIcon('play');
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
    } else {
      setIcon('pause');
      anim.setValue(1);
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [paused, anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.flashWrap, { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
    >
      <View style={styles.flashBtn}>
        {icon === 'play'
          ? <Play size={34} color="#FFF" fill="#FFF" style={{ marginLeft: 4 }} />
          : <Pause size={32} color="#FFF" fill="#FFF" />}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  fill: { height: 2, backgroundColor: '#FFFFFF' },
  flashWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  flashBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
