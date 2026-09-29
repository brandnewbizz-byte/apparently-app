/**
 * ActiveSpeakers — small profile pictures for people currently talking.
 *
 * Shows avatars of participants whose mic is on (presence `isTalking`) with a
 * subtle pulsing ring when they are actively emitting audio (audio-relay
 * `speakingIds`), falling back to the presence talking flag.
 */
import { useEffect, useRef } from 'react';
import { Animated, Image as RNImage, Text, View } from 'react-native';
import type { PostPresenceParticipant } from '@/hooks/usePostPresence';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop';

function SpeakingRing() {
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

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#22C55E',
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

interface ActiveSpeakersProps {
  participants: PostPresenceParticipant[];
  speakingIds: string[];
  /** Max avatars to render before collapsing into "+N". */
  max?: number;
}

export default function ActiveSpeakers({ participants, speakingIds, max = 4 }: ActiveSpeakersProps) {
  const talkers = participants.filter((p) => p.isTalking);
  if (talkers.length === 0) return null;

  const shown = talkers.slice(0, max);
  const extra = talkers.length - shown.length;
  const speakingSet = new Set(speakingIds);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
      {shown.map((p, i) => {
        const speaking = speakingSet.has(p.userId) || p.isTalking;
        return (
          <View
            key={p.userId}
            style={{ marginLeft: i === 0 ? 0 : -8, width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' }}
          >
            <RNImage source={{ uri: p.avatar || FALLBACK_AVATAR }} style={{ width: '100%', height: '100%' }} />
            {speaking && <SpeakingRing />}
          </View>
        );
      })}
      {extra > 0 && (
        <View
          style={{
            marginLeft: -8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.9)',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}
