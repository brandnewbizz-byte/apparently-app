// StoriesViewer.tsx — Full-screen Instagram/Snapchat-style story viewer
// Auto-advances every 5s, tap left/right for prev/next, long-press to pause.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image as RNImage,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Types ──

export interface StoryUser {
  userId: string;
  name: string;
  avatar: string;
  stories: StoryMedia[];
}

export interface StoryMedia {
  id: string;
  mediaUrl: string;
  backgroundColor?: string;
  textContent?: string;
  createdAt: string;
}

// ── Props ──

interface StoriesViewerProps {
  visible: boolean;
  onClose: () => void;
  allStoryUsers: StoryUser[];
  initialUserIndex: number;
}

// ── Constants ──

const STORY_DURATION_MS = 5000;
const PROGRESS_BAR_HEIGHT = 3;
const PROGRESS_BAR_GAP = 3;
const HEADER_HEIGHT = 80;
const TAP_ZONE_WIDTH = SCREEN_WIDTH * 0.3;

// ── Sub-components ──

// Progress bar row at top of screen
function ProgressBars({
  total,
  current,
  progress,
  paused,
}: {
  total: number;
  current: number;
  progress: Animated.Value;
  paused: boolean;
}) {
  const barWidth =
    (SCREEN_WIDTH - 16 - (total - 1) * PROGRESS_BAR_GAP) / total;

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, idx) => {
        const isActive = idx < current;
        const isCurrent = idx === current;

        return (
          <View
            key={idx}
            style={[
              styles.progressBarBg,
              {
                width: barWidth,
                marginRight: idx < total - 1 ? PROGRESS_BAR_GAP : 0,
                backgroundColor: isActive
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.3)',
              },
            ]}
          >
            {isCurrent && (
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: 'rgba(255,255,255,0.9)',
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Main Component ──

export default function StoriesViewer({
  visible,
  onClose,
  allStoryUsers,
  initialUserIndex,
}: StoriesViewerProps) {
  const insets = useSafeAreaInsets();

  // Index into allStoryUsers
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  // Index within current user's stories
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Animated progress for current story
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived data
  const currentUser = allStoryUsers[userIndex];
  const currentStory = currentUser?.stories?.[storyIndex];
  const totalUserStories = currentUser?.stories?.length ?? 0;

  // Reset story index when user changes
  useEffect(() => {
    setStoryIndex(0);
  }, [userIndex]);

  // Reset progress when story changes
  useEffect(() => {
    progress.setValue(0);
  }, [userIndex, storyIndex]);

  // Auto-advance logic
  const goToNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentUser && storyIndex < totalUserStories - 1) {
      // Next story for same user
      setStoryIndex((prev) => prev + 1);
    } else if (userIndex < allStoryUsers.length - 1) {
      // Next user's first story
      setUserIndex((prev) => prev + 1);
    } else {
      // End of all stories
      onClose();
    }
  }, [currentUser, storyIndex, totalUserStories, userIndex, allStoryUsers.length, onClose]);

  const goToPrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
    } else if (userIndex > 0) {
      // Go to previous user, last story
      setUserIndex((prev) => prev - 1);
      // We need to set storyIndex after the userIndex update takes effect
      const prevUser = allStoryUsers[userIndex - 1];
      if (prevUser) {
        setStoryIndex(prevUser.stories.length - 1);
      }
    }
    // If at first story of first user, do nothing
  }, [storyIndex, userIndex, allStoryUsers]);

  // Progress animation when unpaused
  useEffect(() => {
    if (paused || !visible) {
      progressAnim.current?.stop();
      return;
    }

    progress.setValue(0);

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      useNativeDriver: false,
    });

    progressAnim.current = anim;
    anim.start();

    timerRef.current = setTimeout(() => {
      goToNext();
    }, STORY_DURATION_MS);

    return () => {
      anim.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paused, visible, userIndex, storyIndex, progress, goToNext]);

  // Pan responder for swipe-down-to-dismiss
  const panY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 15 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            panY.setValue(gestureState.dy);
            opacity.setValue(1 - gestureState.dy / (SCREEN_HEIGHT * 0.4));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > SCREEN_HEIGHT * 0.2) {
            // Dismiss
            Animated.parallel([
              Animated.timing(panY, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onClose();
              panY.setValue(0);
              opacity.setValue(1);
            });
          } else {
            // Snap back
            Animated.parallel([
              Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [panY, opacity, onClose],
  );

  // Tap handlers
  const handleTapLeft = useCallback(() => {
    goToPrev();
  }, [goToPrev]);

  const handleTapRight = useCallback(() => {
    goToNext();
  }, [goToNext]);

  const handleLongPress = useCallback(() => {
    setPaused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePressOut = useCallback(() => {
    if (paused) {
      setPaused(false);
    }
  }, [paused]);

  if (!currentUser || !currentStory) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: panY }],
            opacity,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Story Media */}
        <View style={styles.mediaContainer}>
          <RNImage
            source={{ uri: currentStory.mediaUrl }}
            style={styles.media}
            resizeMode="cover"
          />
          {/* Optional text overlay */}
          {currentStory.textContent ? (
            <View style={styles.textOverlay}>
              <Text style={styles.textOverlayText}>
                {currentStory.textContent}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Progress Bars */}
        <View style={[styles.progressContainer, { top: insets.top + 8 }]}>
          <ProgressBars
            total={totalUserStories}
            current={storyIndex}
            progress={progress}
            paused={paused}
          />
        </View>

        {/* Header: Avatar + Name + Close */}
        <View style={[styles.header, { top: insets.top + 24 }]}>
          <View style={styles.headerLeft}>
            <RNImage
              source={{ uri: currentUser.avatar }}
              style={styles.headerAvatar}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>
                {currentUser.name}
              </Text>
              <Text style={styles.headerTime}>
                {formatStoryTime(currentStory.createdAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Pause indicator */}
        {paused && (
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseBadge}>
              <Text style={styles.pauseText}>⏸ Paused</Text>
            </View>
          </View>
        )}

        {/* Tap zones for navigation */}
        <TouchableOpacity
          style={[styles.tapZone, styles.tapZoneLeft]}
          onPress={handleTapLeft}
          activeOpacity={0}
        />
        <TouchableOpacity
          style={[styles.tapZone, styles.tapZoneRight]}
          onPress={handleTapRight}
          onLongPress={handleLongPress}
          onPressOut={handlePressOut}
          activeOpacity={0}
        />

        {/* Previous/Next story indicators */}
        {storyIndex > 0 && (
          <View style={[styles.navArrow, styles.navArrowLeft]}>
            <ChevronLeft size={18} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        {storyIndex < totalUserStories - 1 && (
          <View style={[styles.navArrow, styles.navArrowRight]}>
            <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Helpers ──

function formatStoryTime(createdAt: string): string {
  try {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textOverlayText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressContainer: {
    position: 'absolute',
    left: 8,
    right: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    height: PROGRESS_BAR_HEIGHT,
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  headerName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pauseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  tapZoneLeft: {
    left: 0,
    width: TAP_ZONE_WIDTH,
  },
  tapZoneRight: {
    right: 0,
    width: SCREEN_WIDTH - TAP_ZONE_WIDTH,
  },
  navArrow: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowLeft: {
    left: 4,
  },
  navArrowRight: {
    right: 4,
  },
});
