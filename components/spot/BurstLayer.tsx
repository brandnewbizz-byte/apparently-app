import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { Burst } from '@/hooks/useSpotRoom';

function Floater({ emoji, x, width, height }: { emoji: string; x: number; width: number; height: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const drift = useRef((Math.random() - 0.5) * 80).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: Math.min(Math.max(x * width - 22, 8), width - 52),
        top: height - 120,
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.6] }) },
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.3, 1] }) },
        ],
      }}
    >
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
    </Animated.View>
  );
}

/** Reactions that float up the room for everyone. */
export default function BurstLayer({ bursts, width, height }: { bursts: Burst[]; width: number; height: number }) {
  if (!width) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bursts.map((b) => <Floater key={b.key} emoji={b.emoji} x={b.x} width={width} height={height} />)}
    </View>
  );
}
