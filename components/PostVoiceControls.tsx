/**
 * PostVoiceControls — hold-to-talk mic + sound on/off, overlaid on a post.
 *
 * Hold the mic to talk (walkie-talkie style), let go to stop. Everyone on the
 * post hears you; the speaker button turns other people's voices on or off.
 *
 * Flat rows (no flexShrink / flex:1 / space-between) to avoid the native
 * flex-row-in-absolute-overlay crash seen on RN 0.86.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mic, Volume2, VolumeX } from 'lucide-react-native';
import type { VoiceConnectionState } from '@/hooks/usePostVoiceRoom';

interface PostVoiceControlsProps {
  soundOn: boolean;
  talking: boolean;
  connectionState: VoiceConnectionState;
  error: string | null;
  onToggleSound: () => void;
  onStartTalking: () => Promise<'ok' | 'denied' | 'failed'>;
  onStopTalking: () => void;
}

const pillBase = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 18,
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

export default function PostVoiceControls({
  soundOn,
  talking,
  connectionState,
  error,
  onToggleSound,
  onStartTalking,
  onStopTalking,
}: PostVoiceControlsProps) {
  const connecting = connectionState === 'connecting';
  const ready = connectionState === 'connected';
  const pressing = useRef(false);
  const ring = useRing(talking);

  const down = async () => {
    if (!ready) return;
    pressing.current = true;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const r = await onStartTalking();
    // Let go before the mic finished starting → stop right away.
    if (r === 'ok' && !pressing.current) onStopTalking();
  };
  const up = () => {
    pressing.current = false;
    onStopTalking();
  };

  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Hold to talk */}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPressIn={down}
            onPressOut={up}
            disabled={!ready}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={talking ? 'Talking. Let go to stop' : 'Hold to talk'}
            style={[
              pillBase,
              {
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 24,
                backgroundColor: talking ? 'rgba(239,68,68,0.95)' : 'rgba(0,0,0,0.6)',
                borderWidth: 1.5,
                borderColor: talking ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                opacity: ready ? 1 : 0.6,
              },
            ]}
          >
            <Mic size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
              {talking ? 'Talking… let go to stop' : 'Hold to talk'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Sound on / off */}
        <TouchableOpacity
          style={[pillBase, { paddingHorizontal: 10, backgroundColor: soundOn ? 'rgba(34,197,94,0.85)' : 'rgba(0,0,0,0.6)' }]}
          onPress={onToggleSound}
          activeOpacity={0.8}
          accessibilityLabel={soundOn ? 'Turn live sound off' : 'Turn live sound on'}
        >
          {soundOn ? <Volume2 size={16} color="#FFFFFF" /> : <VolumeX size={16} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>

      {connecting && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' }}>Connecting…</Text>
        </View>
      )}

      {error && (
        <Text
          numberOfLines={1}
          style={{
            color: 'rgba(255,255,255,0.95)',
            fontSize: 11,
            fontWeight: '600',
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
