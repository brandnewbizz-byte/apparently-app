/**
 * PostVoiceControls — compact live-voice controls overlaid on a post.
 *
 * Control surface: Listen (join audio, no mic) · Go Live (broadcast your mic)
 * · Mute · End. A pulsing LIVE state makes it obvious when you're on air.
 *
 * Flat rows (no flexShrink / flex:1 / space-between) to avoid the native
 * flex-row-in-absolute-overlay crash seen on RN 0.86.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Text, TouchableOpacity, View } from 'react-native';
import { Headphones, Mic, MicOff, X } from 'lucide-react-native';
import type { VoiceConnectionState } from '@/hooks/usePostVoiceRoom';

interface PostVoiceControlsProps {
  listening: boolean;
  micActive: boolean;
  muted: boolean;
  connectionState: VoiceConnectionState;
  error: string | null;
  onToggleListen: () => void;
  onToggleTalk: () => void;
  onToggleMute: () => void;
}

const pillBase = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 18,
};

function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });

  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#FFFFFF',
          opacity,
          transform: [{ scale }],
        }}
      />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}

export default function PostVoiceControls({
  listening,
  micActive,
  muted,
  connectionState,
  error,
  onToggleListen,
  onToggleTalk,
  onToggleMute,
}: PostVoiceControlsProps) {
  const connecting = connectionState === 'connecting';
  const live = micActive;

  return (
    <View style={{ alignItems: 'flex-start', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Go Live / Live — primary live-voice action */}
        <TouchableOpacity
          style={[
            pillBase,
            { backgroundColor: live ? 'rgba(239,68,68,0.95)' : 'rgba(239,68,68,0.35)' },
          ]}
          onPress={onToggleTalk}
          disabled={connecting}
          activeOpacity={0.8}
        >
          {live ? <LiveDot /> : <Mic size={15} color="#FFFFFF" />}
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
            {live ? 'Talking' : 'Talk'}
          </Text>
        </TouchableOpacity>

        {/* Listen */}
        <TouchableOpacity
          style={[pillBase, { backgroundColor: listening ? 'rgba(34,197,94,0.85)' : 'rgba(0,0,0,0.55)' }]}
          onPress={onToggleListen}
          disabled={connecting || live}
          activeOpacity={0.8}
        >
          <Headphones size={15} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
            {listening ? 'Listening Live' : 'Listen Live'}
          </Text>
        </TouchableOpacity>

        {/* Mute / Unmute — only while live */}
        {live && (
          <TouchableOpacity
            style={[pillBase, { backgroundColor: muted ? 'rgba(245,158,11,0.9)' : 'rgba(0,0,0,0.55)' }]}
            onPress={onToggleMute}
            activeOpacity={0.8}
          >
            {muted ? <MicOff size={15} color="#FFFFFF" /> : <Mic size={15} color="#FFFFFF" />}
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
              {muted ? 'Unmute' : 'Mute'}
            </Text>
          </TouchableOpacity>
        )}

        {/* End Live — stop broadcasting */}
        {live && (
          <TouchableOpacity
            style={[pillBase, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={onToggleTalk}
            activeOpacity={0.8}
          >
            <X size={15} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>End</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Connecting state */}
      {connecting && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' }}>
            Connecting…
          </Text>
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
