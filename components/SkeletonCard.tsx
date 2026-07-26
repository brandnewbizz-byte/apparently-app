import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonCardProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Accent color for the shimmer, defaults to light gray */
  shimmerColor?: string;
  /** Background color for the skeleton blocks */
  baseColor?: string;
}

function SkeletonBlock({ width, height, style, shimmerColor, baseColor }: {
  width: number | string;
  height: number;
  style?: any;
  shimmerColor: string;
  baseColor: string;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: baseColor,
          borderRadius: 8,
          opacity,
        },
        style,
      ]}
    />
  );
}

export default function SkeletonCard({ count = 3, shimmerColor = '#E5E5E5', baseColor = '#F0F0F0' }: SkeletonCardProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          {/* Header: avatar + name */}
          <View style={styles.header}>
            <SkeletonBlock width={40} height={40} shimmerColor={shimmerColor} baseColor={baseColor} style={{ borderRadius: 20 }} />
            <View style={styles.headerText}>
              <SkeletonBlock width={120} height={14} shimmerColor={shimmerColor} baseColor={baseColor} />
              <SkeletonBlock width={80} height={10} shimmerColor={shimmerColor} baseColor={baseColor} style={{ marginTop: 6 }} />
            </View>
          </View>

          {/* Image placeholder */}
          <SkeletonBlock
            width="100%"
            height={200}
            shimmerColor={shimmerColor}
            baseColor={baseColor}
            style={{ borderRadius: 12, marginTop: 10 }}
          />

          {/* Title */}
          <SkeletonBlock width="80%" height={16} shimmerColor={shimmerColor} baseColor={baseColor} style={{ marginTop: 12 }} />
          <SkeletonBlock width="60%" height={12} shimmerColor={shimmerColor} baseColor={baseColor} style={{ marginTop: 8 }} />

          {/* Action buttons */}
          <View style={styles.actions}>
            <SkeletonBlock width={60} height={32} shimmerColor={shimmerColor} baseColor={baseColor} />
            <SkeletonBlock width={60} height={32} shimmerColor={shimmerColor} baseColor={baseColor} />
            <SkeletonBlock width={60} height={32} shimmerColor={shimmerColor} baseColor={baseColor} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
});

/** Simpler skeleton for the Live tab's stream cards */
export function SkeletonStreamCard({ count = 3, baseColor = '#2A2A2A', shimmerColor = '#3A3A3A' }: SkeletonCardProps) {
  return (
    <View style={streamStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={streamStyles.card}>
          <SkeletonBlock
            width="100%"
            height={180}
            shimmerColor={shimmerColor}
            baseColor={baseColor}
            style={{ borderRadius: 16 }}
          />
          <View style={streamStyles.row}>
            <SkeletonBlock width={36} height={36} shimmerColor={shimmerColor} baseColor={baseColor} style={{ borderRadius: 18 }} />
            <View style={{ flex: 1 }}>
              <SkeletonBlock width="70%" height={14} shimmerColor={shimmerColor} baseColor={baseColor} />
              <SkeletonBlock width="40%" height={10} shimmerColor={shimmerColor} baseColor={baseColor} style={{ marginTop: 6 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const streamStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
});
