/**
 * PostVoiceControls — live voice on a post.
 *
 *  • Press and hold the mic to go live (the mic stays on after you let go).
 *  • While live: a mic button mutes / unmutes you, and End goes off-air.
 *  • The speaker button mutes everyone else — on every post, until you unmute.
 *
 * Flat rows (no flexShrink / flex:1 / space-between) to avoid the native
 * flex-row-in-absolute-overlay crash seen on RN 0.86.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react-native';
import type { VoiceConnectionState } from '@/hooks/usePostVoiceRoom';

interface PostVoiceControlsProps {
  soundOn: boolean;
  live: boolean;
  micMuted: boolean;
  connectionState: VoiceConnectionState;
  error: string | null;
  onToggleSound: () => void;
  onGoLive: () => Promise<'ok' | 'denied' | 'failed'>;
  onEndLive: () => void;
  onToggleMic: () => void;
}

const pill = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
};

function useRing(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { v.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v;
}

const tap = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
};

export default function PostVoiceControls({
  soundOn, live, micMuted, connectionState, error, onToggleSound, onGoLive, onEndLive, onToggleMic,
}: PostVoiceControlsProps) {
  const ready = connectionState === 'connected';
  const ring = useRing(live && !micMuted);
  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const sound = (
    <TouchableOpacity
      style={[pill, { paddingHorizontal: 10, backgroundColor: soundOn ? 'rgba(0,0,0,0.6)' : 'rgba(239,68,68,0.9)' }]}
      onPress={() => { tap(); onToggleSound(); }}
      activeOpacity={0.8}
      accessibilityLabel={soundOn ? 'Mute live voices on all posts' : 'Unmute live voices'}
    >
      {soundOn ? <Volume2 size={17} color="#FFFFFF" /> : <VolumeX size={17} color="#FFFFFF" />}
    </TouchableOpacity>
  );

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {live ? (
          <>
            {/* Mute / unmute your mic */}
            <Animated.View style={{ transform: [{ scale }] }}>
              <TouchableOpacity
                onPress={() => { tap(); onToggleMic(); }}
                activeOpacity={0.8}
                accessibilityLabel={micMuted ? 'Unmute your mic' : 'Mute your mic'}
                style={[pill, {
                  backgroundColor: micMuted ? 'rgba(0,0,0,0.6)' : 'rgba(239,68,68,0.95)',
                  borderWidth: 1.5, borderColor: '#FFFFFF',
                }]}
              >
                {micMuted ? <MicOff size={17} color="#FFFFFF" /> : <Mic size={17} color="#FFFFFF" />}
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{micMuted ? 'Mic off' : 'Live'}</Text>
              </TouchableOpacity>
            </Animated.View>
            {/* Go off-air */}
            <TouchableOpacity
              onPress={() => { tap(Haptics.ImpactFeedbackStyle.Medium); onEndLive(); }}
              activeOpacity={0.8}
              accessibilityLabel="End live"
              style={[pill, { paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.6)' }]}
            >
              <X size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>End</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Press and hold to go live */
          <Pressable
            onLongPress={() => { tap(Haptics.ImpactFeedbackStyle.Heavy); onGoLive(); }}
            delayLongPress={350}
            disabled={!ready}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Press and hold to go live"
            style={({ pressed }) => [pill, {
              backgroundColor: pressed ? 'rgba(239,68,68,0.8)' : 'rgba(0,0,0,0.6)',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', opacity: ready ? 1 : 0.6,
            }]}
          >
            <Mic size={17} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Hold to go live</Text>
          </Pressable>
        )}
        {sound}
      </View>

      {connectionState === 'connecting' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' }}>Connecting…</Text>
        </View>
      )}

      {error && (
        <Text
          numberOfLines={1}
          style={{
            color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '600',
            backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
