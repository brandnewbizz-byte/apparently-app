// StoryRing.tsx — Instagram-style circular avatar with gradient border ring
// Pulsing animation for unviewed stories. Tapping opens StoriesViewer.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image as RNImage,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// ── Props ──

interface StoryRingProps {
  /** User avatar URL */
  avatar: string;
  /** Display name (shown below ring) */
  name: string;
  /** Whether user has unviewed stories — controls gradient + pulse */
  hasUnviewed: boolean;
  /** Ring size (default: 68) */
  size?: number;
  /** Name font size (default: 12) */
  nameSize?: number;
  /** Show plus icon for "add story" mode */
  isAddStory?: boolean;
  /** Tap handler */
  onPress: () => void;
}

// ── Component ──

export default function StoryRing({
  avatar,
  name,
  hasUnviewed,
  size = 68,
  nameSize = 12,
  isAddStory = false,
  onPress,
}: StoryRingProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for unviewed stories
  useEffect(() => {
    if (!hasUnviewed) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [hasUnviewed, pulseAnim]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const borderWidth = size * 0.05;
  const avatarSize = size - borderWidth * 2 - 4;

  if (isAddStory) {
    // "Add Story" button with plus icon
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.ringWrapper,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.addRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth,
                borderColor: '#888',
                borderStyle: 'dashed',
              },
            ]}
          >
            <View
              style={[
                styles.avatarContainer,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  backgroundColor: '#333',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <RNImage
                source={{ uri: avatar }}
                style={[
                  styles.avatar,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                  },
                ]}
              />
              {/* Plus icon overlay */}
              <View style={styles.plusIconContainer}>
                <Text style={styles.plusIcon}>+</Text>
              </View>
            </View>
          </View>
        </Animated.View>
        <Text
          style={[styles.name, { fontSize: nameSize, marginTop: size * 0.08 }]}
          numberOfLines={1}
        >
          {name}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.ringWrapper,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {hasUnviewed ? (
          <LinearGradient
            colors={['#F58529', '#DD2A7B', '#8134AF']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.gradientRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          >
            <View
              style={[
                styles.avatarContainer,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
            >
              <RNImage
                source={{ uri: avatar }}
                style={[
                  styles.avatar,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                  },
                ]}
              />
            </View>
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.plainRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth,
              },
            ]}
          >
            <RNImage
              source={{ uri: avatar }}
              style={[
                styles.avatar,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
            />
          </View>
        )}
      </Animated.View>
      <Text
        style={[styles.name, { fontSize: nameSize, marginTop: size * 0.08 }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginHorizontal: 7,
    width: 76,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientRing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  plainRing: {
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    overflow: 'hidden',
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    resizeMode: 'cover',
  },
  plusIconContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  plusIcon: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  name: {
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
});
