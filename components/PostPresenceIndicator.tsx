/**
 * PostPresenceIndicator — live "pulse" pill for a single post.
 *
 * Shows a LIVE badge (with a pulsing green dot while connected) plus how many
 * people are on this post and how many are talking. The dot animates only when
 * the presence channel is actually connected, so "LIVE" always reflects a real
 * open channel rather than a stale count.
 */
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface PostPresenceIndicatorProps {
  presenceCount: number;
  talkingCount: number;
  connected: boolean;
}

export default function PostPresenceIndicator({
  presenceCount,
  talkingCount,
  connected,
}: PostPresenceIndicatorProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!connected) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [connected, pulse]);

  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.25] });

  const live = connected && presenceCount > 0;

  let label: string;
  if (!live) {
    label = 'Offline';
  } else if (presenceCount <= 1) {
    label = talkingCount > 0 ? "You're live" : "You're here";
  } else {
    label = `${presenceCount} here`;
    if (talkingCount > 0) label += ` · ${talkingCount} talking`;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
      }}
    >
      <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
        {live && (
          <Animated.View
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#22C55E',
              opacity: dotOpacity,
              transform: [{ scale: dotScale }],
            }}
          />
        )}
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: live ? '#22C55E' : 'rgba(255,255,255,0.4)',
          }}
        />
      </View>

      {live && (
        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
          LIVE
        </Text>
      )}

      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
