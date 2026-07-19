import {
  ArrowRight, 
  Calendar, 
  ChevronLeft,
  ChevronRight,
  Gift,
  MapPin,
  Package,
  X,
  Bookmark,
  Trophy,
  MessageCircle,
  Sparkles,
  Wrench,
  Star,
  Heart,
  Dumbbell,
  Utensils,
  Plane,
  Music,
  Palette,
  Clock,
  Briefcase,
  Plus,
  Camera,
  ImagePlus,
  BarChart3,
} from 'lucide-react-native';
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  PanResponder,
  ImageBackground,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { supabase } from '@/lib/supabase';
import * as localApi from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { isAbortError, logAbort, withAbortSignal } from '@/lib/abort';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BundlePlan {
  id: string;
  title: string;
  price: number;
  items: number | string[];
  type: string;
  image: string;
  distance: number;
  bookedAt?: string;
  pickupTime?: string;
  status: 'available' | 'grabbed';
  creatorId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  creator?: {
    name: string;
    avatar: string;
    rating: number;
    reviews: number;
  };
  summary?: string[];
  description?: string;
  imageUrl?: string;
  category?: string;
  grabCount?: number;
  location?: string;
}

interface LifestyleCategory {
  id: string;
  title: string;
  icon: any;
  color: string;
  count: number;
  image: string;
}

const MOCK_BUNDLES: BundlePlan[] = [
  {
    id: 'bundle-1',
    title: 'Weekend Escape Pack',
    price: 299,
    items: 5,
    type: 'lifestyle',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    distance: 15.2,
    status: 'available',
    creatorId: 'u-2',
    summary: ['Beach resort stay', 'Spa treatment', 'Sunset cruise', 'Dinner for 2', 'Breakfast buffet'],
    creator: {
      name: 'Sarah Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      rating: 4.9,
      reviews: 127,
    },
  },
  {
    id: 'bundle-2',
    title: 'Self-Care Sunday',
    price: 149,
    items: 3,
    type: 'wellness',
    image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800',
    distance: 2.8,
    status: 'available',
    creatorId: 'u-3',
    summary: ['Full body massage', 'Facial treatment', 'Yoga session'],
    creator: {
      name: 'Maya Rose',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      rating: 4.8,
      reviews: 89,
    },
  },
  {
    id: 'bundle-3',
    title: 'Date Night Bundle',
    price: 199,
    items: 4,
    type: 'experience',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    distance: 4.5,
    status: 'available',
    creatorId: 'u-4',
    summary: ['Fine dining', 'Movie tickets', 'Dessert bar', 'Roses bouquet'],
    creator: {
      name: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      rating: 4.7,
      reviews: 203,
    },
  },
];

const MOCK_HOT_BUNDLES: BundlePlan[] = [
  {
    id: 'hbundle-1',
    title: 'Fitness Starter',
    price: 179,
    items: 4,
    type: 'health',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    distance: 1.5,
    status: 'available',
    creatorId: 'u-5',
    summary: ['Personal training', 'Nutrition plan', 'Gym pass', 'Protein pack'],
    creator: {
      name: 'Jake Fitness',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      rating: 4.9,
      reviews: 312,
    },
  },
  {
    id: 'hbundle-2',
    title: 'Adventure Pack',
    price: 399,
    items: 6,
    type: 'outdoor',
    image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800',
    distance: 22.3,
    status: 'available',
    creatorId: 'u-6',
    summary: ['Hiking guide', 'Kayak rental', 'Camping gear', 'BBQ setup', 'Photo session', 'Trail snacks'],
    creator: {
      name: 'Zoe Wild',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      rating: 5.0,
      reviews: 156,
    },
  },
  {
    id: 'hbundle-3',
    title: 'Luxury Retreat',
    price: 599,
    items: 8,
    type: 'premium',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
    distance: 35.0,
    status: 'available',
    creatorId: 'u-7',
    summary: ['5-star suite', 'Private chef', 'Spa day', 'Limo service', 'Wine tasting', 'Golf round', 'Butler service', 'Champagne'],
    creator: {
      name: 'Elite Escapes',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100',
      rating: 4.8,
      reviews: 89,
    },
  },
];

const LIFESTYLE_CATEGORIES: LifestyleCategory[] = [
  { id: 'wellness', title: 'Wellness', icon: Heart, color: '#EC4899', count: 24, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400' },
  { id: 'fitness', title: 'Fitness', icon: Dumbbell, color: '#10B981', count: 18, image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400' },
  { id: 'dining', title: 'Dining', icon: Utensils, color: '#F59E0B', count: 32, image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400' },
  { id: 'travel', title: 'Travel', icon: Plane, color: '#3B82F6', count: 15, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
  { id: 'entertainment', title: 'Entertainment', icon: Music, color: '#8B5CF6', count: 28, image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400' },
  { id: 'creative', title: 'Creative', icon: Palette, color: '#EF4444', count: 12, image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400' },
];

interface SkillDeal {
  id: string;
  title: string;
  icon: string;
  price: number;
  originalPrice: number;
  rating: number;
  image: string;
  distance: number;
  expiresIn: number;
  creatorId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  provider: {
    name: string;
    avatar: string;
  };
  description?: string;
  imageUrl?: string;
  category?: string;
  grabCount?: number;
}

const MOCK_SKILL_DEALS: SkillDeal[] = [
  { id: 's1', title: 'Home Cleaning', icon: '🧹', price: 35, originalPrice: 45, rating: 4.9, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400', distance: 2.1, expiresIn: 1800, creatorId: 'u-2', provider: { name: 'Maria S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' } },
  { id: 's2', title: 'Personal Chef', icon: '👨‍🍳', price: 89, originalPrice: 120, rating: 4.8, image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400', distance: 3.5, expiresIn: 3600, creatorId: 'u-4', provider: { name: 'Chef Tony', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' } },
  { id: 's3', title: 'Dog Walking', icon: '🐕', price: 18, originalPrice: 25, rating: 5.0, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', distance: 0.8, expiresIn: 900, creatorId: 'u-5', provider: { name: 'Jake W.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' } },
  { id: 's4', title: 'Photography', icon: '📸', price: 65, originalPrice: 85, rating: 4.7, image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400', distance: 5.2, expiresIn: 7200, creatorId: 'u-3', provider: { name: 'Lisa P.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' } },
  { id: 's5', title: 'Tutoring', icon: '📚', price: 30, originalPrice: 40, rating: 4.9, image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400', distance: 1.5, expiresIn: 5400, creatorId: 'u-6', provider: { name: 'Prof. Kim', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' } },
];

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  budget: number;
  image: string;
  distance: number;
  expiresIn: number;
  creatorId?: string;
  requester: {
    name: string;
    avatar: string;
    rating: number;
  };
  category: string;
}

const MOCK_SERVICE_REQUESTS: ServiceRequest[] = [
  { id: 'sr1', title: 'Need Help Moving', description: 'Looking for 2 people to help move furniture this Saturday', budget: 150, image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', distance: 4.2, expiresIn: 14400, creatorId: 'u-4', requester: { name: 'Tom H.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', rating: 4.8 }, category: 'Moving' },
  { id: 'sr2', title: 'Party Planner Needed', description: 'Planning a surprise birthday party for 30 guests', budget: 300, image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800', distance: 6.8, expiresIn: 28800, creatorId: 'u-2', requester: { name: 'Emma L.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', rating: 4.9 }, category: 'Events' },
  { id: 'sr3', title: 'Garden Makeover', description: 'Need landscaping help for backyard renovation', budget: 250, image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800', distance: 3.1, expiresIn: 43200, creatorId: 'u-5', requester: { name: 'Mike R.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', rating: 4.7 }, category: 'Home' },
];

const LIVE_UPDATES = [
  { name: 'Jake', action: 'booked', amount: 18, service: 'VA', time: '2 mins ago' },
  { name: 'Sarah', action: 'grabbed', amount: 45, service: 'Cleaning', time: '3 mins ago' },
  { name: 'Mike', action: 'booked', amount: 120, service: 'Chef', time: '5 mins ago' },
  { name: 'Emma', action: 'grabbed', amount: 299, service: 'Bundle', time: '7 mins ago' },
  { name: 'Alex', action: 'booked', amount: 85, service: 'Photo', time: '8 mins ago' },
];

const CAROUSEL_SETS = {
  bundles: [
    { key: 'recommend', label: 'For You', data: MOCK_BUNDLES },
    { key: 'hot', label: 'Hot', data: MOCK_HOT_BUNDLES },
  ],
};

interface SwipeableBundlesProps {
  bundles: BundlePlan[];
  onGrab: (bundle: BundlePlan) => void;
  onSkip: (bundle: BundlePlan) => void;
  onSave: (bundle: BundlePlan) => void;
  colors: any;
}

const BUNDLE_LIMIT = 7;
const COOLDOWN_SECONDS = 60;

const SKILL_LIMIT = 10;
const SKILL_COOLDOWN_SECONDS = 3 * 60;

function SwipeableBundles({ bundles, onGrab, onSkip, onSave, colors }: SwipeableBundlesProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(COOLDOWN_SECONDS);
  const [bundleRound, setBundleRound] = useState(0);
  const [grabPreviewActive, setGrabPreviewActive] = useState(false);
  const swipeAnim = useRef(new Animated.ValueXY()).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;

  const limitedBundles = useMemo(() => {
    const startIdx = (bundleRound * BUNDLE_LIMIT) % bundles.length;
    const result: BundlePlan[] = [];
    for (let i = 0; i < BUNDLE_LIMIT && i < bundles.length; i++) {
      result.push(bundles[(startIdx + i) % bundles.length]);
    }
    return result;
  }, [bundles, bundleRound]);

  const visibleBundles = useMemo(
    () => limitedBundles.filter((bundle) => !dismissedIds.includes(bundle.id)),
    [dismissedIds, limitedBundles]
  );

  const currentBundle = visibleBundles[0];
  const nextBundle = visibleBundles[1];
  const completedCount = limitedBundles.length - visibleBundles.length;

  // Track view when a new bundle is shown
  useEffect(() => {
    if (currentBundle?.id) {
      localApi.trackDealStat('bundle', currentBundle.id, 'view');
    }
  }, [currentBundle?.id]);

  useEffect(() => {
    setDismissedIds((prev) => prev.filter((id) => limitedBundles.some((bundle) => bundle.id === id)));
  }, [limitedBundles]);

  useEffect(() => {
    if (!isOnCooldown && limitedBundles.length > 0 && visibleBundles.length === 0) {
      setIsOnCooldown(true);
      setCooldownRemaining(COOLDOWN_SECONDS);
    }
  }, [isOnCooldown, limitedBundles.length, visibleBundles.length]);

  useEffect(() => {
    if (!isOnCooldown) return;

    const interval = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsOnCooldown(false);
          setDismissedIds([]);
          setBundleRound(r => r + 1);
          return COOLDOWN_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnCooldown]);

  const resetCard = useCallback(() => {
    swipeAnim.setValue({ x: 0, y: 0 });
    rotateAnim.setValue(0);
    opacityAnim.setValue(1);
    nextCardScale.setValue(0.95);
  }, [swipeAnim, rotateAnim, opacityAnim, nextCardScale]);

  const dismissBundle = useCallback((bundleId: string) => {
    setDismissedIds((prev) => (prev.includes(bundleId) ? prev : [...prev, bundleId]));
  }, []);

  const completeAction = useCallback((action: 'skip' | 'save' | 'grab') => {
    if (!currentBundle) return;

    // Track analytics
    if (action === 'grab') localApi.trackDealStat('bundle', currentBundle.id, 'grab');
    else if (action === 'skip') localApi.trackDealStat('bundle', currentBundle.id, 'skip');

    if (action === 'save') {
      onSave(currentBundle);
    } else if (action === 'skip') {
      onSkip(currentBundle);
    } else {
      onGrab(currentBundle);
    }

    dismissBundle(currentBundle.id);
    resetCard();
  }, [currentBundle, dismissBundle, onGrab, onSave, onSkip, resetCard]);

  const swipeCard = useCallback((direction: 'left' | 'right') => {
    if (grabPreviewActive) return;
    const toValue = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;

    Animated.parallel([
      Animated.timing(swipeAnim.x, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(nextCardScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      completeAction(direction === 'right' ? 'save' : 'skip');
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [completeAction, grabPreviewActive, swipeAnim.x, opacityAnim, nextCardScale]);

  const grabCurrentBundle = useCallback(() => {
    if (!currentBundle || grabPreviewActive) return;
    setGrabPreviewActive(true);
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(swipeAnim.y, {
          toValue: -30,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(nextCardScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setGrabPreviewActive(false);
        completeAction('grab');
      });
    }, 800);

    return () => clearTimeout(timeout);
  }, [completeAction, currentBundle, grabPreviewActive, nextCardScale, opacityAnim, swipeAnim.y]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !grabPreviewActive,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      if (grabPreviewActive) return false;
      return Math.abs(gestureState.dx) > 2;
    },
    onPanResponderMove: (_, gestureState) => {
      swipeAnim.setValue({ x: gestureState.dx, y: 0 });
      rotateAnim.setValue(gestureState.dx / SCREEN_WIDTH);
      const progress = Math.min(Math.abs(gestureState.dx) / (SCREEN_WIDTH * 0.4), 1);
      nextCardScale.setValue(0.95 + (0.05 * progress));
    },
    onPanResponderRelease: (_, gestureState) => {
      const swipeThreshold = SCREEN_WIDTH * 0.2;
      const velocityThreshold = 0.5;

      // Commit on distance OR fast flick
      const shouldCommitRight = gestureState.dx > swipeThreshold || (gestureState.dx > 20 && gestureState.vx > velocityThreshold);
      const shouldCommitLeft = gestureState.dx < -swipeThreshold || (gestureState.dx < -20 && gestureState.vx < -velocityThreshold);

      if (shouldCommitRight) {
        swipeCard('right');
      } else if (shouldCommitLeft) {
        swipeCard('left');
      } else {
        Animated.parallel([
          Animated.spring(swipeAnim, {
            toValue: { x: 0, y: 0 },
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
          Animated.spring(rotateAnim, {
            toValue: 0,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
          Animated.spring(nextCardScale, {
            toValue: 0.95,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  }), [grabPreviewActive, swipeAnim, rotateAnim, nextCardScale, swipeCard]);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const skipOpacity = swipeAnim.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.3, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const saveOpacity = swipeAnim.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.3],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const formatCooldownTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isOnCooldown || !currentBundle) {
    return (
      <View style={[styles.swipeEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cooldownIconContainer}>
          <Clock size={48} color="#7B61FF" />
        </View>
        <Text style={[styles.cooldownTimer, { color: colors.text }]}>{formatCooldownTime(cooldownRemaining)}</Text>
        <Text style={[styles.swipeEmptyText, { color: colors.text }]}>No more bundles!</Text>
        <Text style={[styles.swipeEmptySubtext, { color: colors.textSecondary }]}>Waiting for new bundles to appear...</Text>
        <View style={styles.cooldownProgressContainer}>
          <View style={[styles.cooldownProgressBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.cooldownProgressFill,
                { width: `${((COOLDOWN_SECONDS - cooldownRemaining) / COOLDOWN_SECONDS) * 100}%` }
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.swipeContainer}>
      {nextBundle && (
        <Animated.View style={[styles.swipeCardWrapper, { transform: [{ scale: nextCardScale }] }]}>
          <SwipeBundleCardContent bundle={nextBundle} colors={colors} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.swipeCardWrapper,
          {
            transform: [
              { translateX: swipeAnim.x },
              { rotate },
            ],
            opacity: opacityAnim,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.swipeOverlay, styles.skipOverlay, { opacity: skipOpacity }]}>
          <X size={32} color="#FFF" />
          <Text style={styles.skipOverlayText}>SKIP</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeOverlay, styles.saveOverlay, { opacity: saveOpacity }]}>
          <Bookmark size={32} color="#FFF" />
          <Text style={styles.saveOverlayText}>SAVE</Text>
        </Animated.View>
        {grabPreviewActive ? (
          <View style={styles.grabbedOverlay} pointerEvents="none">
            <Text style={styles.grabbedOverlayText}>GRABBED</Text>
          </View>
        ) : null}
        <SwipeBundleCardContent bundle={currentBundle} colors={colors} />
      </Animated.View>

      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => swipeCard('left')}
          activeOpacity={0.8}
        >
          <X size={22} color="#EF4444" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.swipeGrabBtn}
          onPress={grabCurrentBundle}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#7B61FF', '#A78BFA']}
            style={styles.grabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.swipeGrabText}>Grab</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => swipeCard('right')}
          activeOpacity={0.8}
        >
          <Bookmark size={22} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.swipeIndicator}>
        {limitedBundles.map((_, i) => (
          <View
            key={i}
            style={[
              styles.swipeDot,
              { backgroundColor: colors.border },
              i === completedCount && currentBundle && styles.swipeDotActive,
              i < completedCount && styles.swipeDotDone,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

interface SwipeBundleCardContentProps {
  bundle: BundlePlan;
  colors: any;
}

function SwipeBundleCardContent({ bundle, colors }: SwipeBundleCardContentProps) {
  const getTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      lifestyle: '#7B61FF',
      wellness: '#EC4899',
      experience: '#F59E0B',
      health: '#10B981',
      outdoor: '#3B82F6',
      premium: '#8B5CF6',
      grabbed: '#10B981',
    };
    return typeColors[type] || '#7B61FF';
  };

  return (
    <View style={[styles.bundleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ImageBackground
        source={{ uri: bundle.image }}
        style={styles.bundleCardImage}
        imageStyle={styles.bundleCardImageStyle}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bundleImageOverlay}
        >
          <View style={[styles.bundleTypeTag, { backgroundColor: getTypeColor(bundle.type) }]}>
            <Text style={styles.bundleTypeText}>{bundle.type.toUpperCase()}</Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.bundleCardContent}>
        <View style={styles.bundleCardHeader}>
          <Text style={[styles.bundleCardTitle, { color: colors.text }]}>{bundle.title}</Text>
          <View style={styles.bundleItemsCount}>
            <Package size={14} color="#7B61FF" />
            <Text style={[styles.bundleItemsText, { color: colors.textSecondary }]}>{bundle.items} items</Text>
          </View>
        </View>

        {bundle.creator && (
          <View style={styles.creatorRow}>
            <Image source={{ uri: bundle.creator.avatar }} style={styles.creatorAvatar} />
            <View style={styles.creatorInfo}>
              <Text style={[styles.creatorName, { color: colors.text }]}>{bundle.creator.name}</Text>
              <View style={styles.creatorRating}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{bundle.creator.rating}</Text>
                <Text style={[styles.reviewsText, { color: colors.textTertiary }]}>({bundle.creator.reviews})</Text>
              </View>
            </View>
          </View>
        )}

        {bundle.summary && bundle.summary.length > 0 && (
          <View style={[styles.bundleSummaryBox, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.bundleSummaryText, { color: colors.textSecondary }]} numberOfLines={2}>
              {bundle.summary.slice(0, 3).join(' • ')}{bundle.summary.length > 3 ? ` +${bundle.summary.length - 3} more` : ''}
            </Text>
          </View>
        )}

        <View style={styles.bundleCardFooter}>
          <View style={styles.bundlePriceRow}>
            <Text style={styles.bundlePrice}>${bundle.price}</Text>
            <Text style={[styles.bundlePriceLabel, { color: colors.textTertiary }]}>bundle</Text>
          </View>
          <View style={styles.bundleDistanceRow}>
            <MapPin size={14} color={colors.textTertiary} />
            <Text style={[styles.bundleDistanceText, { color: colors.textTertiary }]}>
              {bundle.distance === 0 ? 'Comes to you' : `${bundle.distance} mi`}
            </Text>
          </View>
        </View>

        <View style={[styles.swipeHint, { borderTopColor: colors.border }]}>
          <View style={styles.swipeHintItem}>
            <ChevronLeft size={16} color="#EF4444" />
            <Text style={[styles.swipeHintText, { color: colors.textTertiary }]}>Skip</Text>
          </View>
          <View style={styles.swipeHintItem}>
            <Text style={[styles.swipeHintText, { color: colors.textTertiary }]}>Save</Text>
            <ChevronRight size={16} color="#10B981" />
          </View>
        </View>
      </View>
    </View>
  );
}

interface GrabbedBundle {
  id: string;
  title: string;
  proposed_budget: number;
  pickup_time: string | null;
  status: string;
  booked_at: string;
  plan_details: any;
}

interface ConfettiModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
}

interface SwipeableSkillsProps {
  skills: SkillDeal[];
  onGrab: (skill: SkillDeal) => void;
  onSkip: (skill: SkillDeal) => void;
  onSave: (skill: SkillDeal) => void;
  colors: any;
}

function formatCountdown(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function SwipeableSkills({ skills, onGrab, onSkip, onSave, colors }: SwipeableSkillsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(SKILL_COOLDOWN_SECONDS);
  const [skillRound, setSkillRound] = useState(0);
  const [grabPreviewActive, setGrabPreviewActive] = useState(false);
  const swipeAnim = useRef(new Animated.ValueXY()).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;

  const limitedSkills = useMemo(() => {
    const startIdx = (skillRound * SKILL_LIMIT) % skills.length;
    const result: SkillDeal[] = [];
    for (let i = 0; i < SKILL_LIMIT && i < skills.length; i++) {
      result.push(skills[(startIdx + i) % skills.length]);
    }
    return result;
  }, [skills, skillRound]);

  const visibleSkills = useMemo(
    () => limitedSkills.filter((skill) => !dismissedIds.includes(skill.id)),
    [dismissedIds, limitedSkills]
  );

  const currentSkill = visibleSkills[0];
  const nextSkill = visibleSkills[1];
  const completedCount = limitedSkills.length - visibleSkills.length;

  useEffect(() => {
    if (currentSkill?.id) localApi.trackDealStat('skill', currentSkill.id, 'view');
  }, [currentSkill?.id]);

  useEffect(() => {
    setDismissedIds((prev) => prev.filter((id) => limitedSkills.some((skill) => skill.id === id)));
  }, [limitedSkills]);

  useEffect(() => {
    if (!isOnCooldown && limitedSkills.length > 0 && visibleSkills.length === 0) {
      setIsOnCooldown(true);
      setCooldownRemaining(SKILL_COOLDOWN_SECONDS);
    }
  }, [isOnCooldown, limitedSkills.length, visibleSkills.length]);

  useEffect(() => {
    if (!isOnCooldown) return;

    const interval = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsOnCooldown(false);
          setDismissedIds([]);
          setSkillRound(r => r + 1);
          return SKILL_COOLDOWN_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnCooldown]);

  const resetCard = useCallback(() => {
    swipeAnim.setValue({ x: 0, y: 0 });
    rotateAnim.setValue(0);
    opacityAnim.setValue(1);
    nextCardScale.setValue(0.95);
  }, [swipeAnim, rotateAnim, opacityAnim, nextCardScale]);

  const dismissSkill = useCallback((skillId: string) => {
    setDismissedIds((prev) => (prev.includes(skillId) ? prev : [...prev, skillId]));
  }, []);

  const completeAction = useCallback((action: 'skip' | 'save' | 'grab') => {
    if (!currentSkill) return;

    if (action === 'grab') localApi.trackDealStat('skill', currentSkill.id, 'grab');
    else if (action === 'skip') localApi.trackDealStat('skill', currentSkill.id, 'skip');

    if (action === 'save') {
      onSave(currentSkill);
    } else if (action === 'skip') {
      onSkip(currentSkill);
    } else {
      onGrab(currentSkill);
    }

    dismissSkill(currentSkill.id);
    resetCard();
  }, [currentSkill, dismissSkill, onGrab, onSave, onSkip, resetCard]);

  const swipeCard = useCallback((direction: 'left' | 'right') => {
    if (grabPreviewActive) return;
    const toValue = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;

    Animated.parallel([
      Animated.timing(swipeAnim.x, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(nextCardScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      completeAction(direction === 'right' ? 'save' : 'skip');
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [completeAction, grabPreviewActive, swipeAnim.x, opacityAnim, nextCardScale]);

  const grabCurrentSkill = useCallback(() => {
    if (!currentSkill || grabPreviewActive) return;
    setGrabPreviewActive(true);
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(swipeAnim.y, { toValue: -30, duration: 180, useNativeDriver: true }),
        Animated.spring(nextCardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start(() => {
        setGrabPreviewActive(false);
        completeAction('grab');
      });
    }, 800);

    return () => clearTimeout(timeout);
  }, [completeAction, currentSkill, grabPreviewActive, nextCardScale, opacityAnim, swipeAnim.y]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !grabPreviewActive,
    onMoveShouldSetPanResponder: (_, gestureState) => !grabPreviewActive && Math.abs(gestureState.dx) > 2,
    onPanResponderMove: (_, gestureState) => {
      swipeAnim.setValue({ x: gestureState.dx, y: 0 });
      rotateAnim.setValue(gestureState.dx / SCREEN_WIDTH);
      const progress = Math.min(Math.abs(gestureState.dx) / (SCREEN_WIDTH * 0.4), 1);
      nextCardScale.setValue(0.95 + (0.05 * progress));
    },
    onPanResponderRelease: (_, gestureState) => {
      const swipeThreshold = SCREEN_WIDTH * 0.2;
      const velocityThreshold = 0.5;
      const shouldCommitRight = gestureState.dx > swipeThreshold || (gestureState.dx > 20 && gestureState.vx > velocityThreshold);
      const shouldCommitLeft = gestureState.dx < -swipeThreshold || (gestureState.dx < -20 && gestureState.vx < -velocityThreshold);
      if (shouldCommitRight) {
        swipeCard('right');
      } else if (shouldCommitLeft) {
        swipeCard('left');
      } else {
        Animated.parallel([
          Animated.spring(swipeAnim, { toValue: { x: 0, y: 0 }, friction: 8, tension: 100, useNativeDriver: true }),
          Animated.spring(rotateAnim, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
          Animated.spring(nextCardScale, { toValue: 0.95, friction: 8, tension: 100, useNativeDriver: true }),
        ]).start();
      }
    },
  }), [grabPreviewActive, swipeAnim, rotateAnim, nextCardScale, swipeCard]);

  const rotate = rotateAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-10deg', '0deg', '10deg'] });
  const skipOpacity = swipeAnim.x.interpolate({ inputRange: [-SCREEN_WIDTH * 0.3, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const saveOpacity = swipeAnim.x.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.3], outputRange: [0, 1], extrapolate: 'clamp' });

  const formatSkillCooldownTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isOnCooldown || !currentSkill) {
    return (
      <View style={[styles.skillEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.skillCooldownIconContainer}>
          <Clock size={40} color="#F59E0B" />
        </View>
        <Text style={[styles.skillCooldownTimer, { color: colors.text }]}>{formatSkillCooldownTime(cooldownRemaining)}</Text>
        <Text style={[styles.swipeEmptyText, { color: colors.text }]}>No more deals!</Text>
        <Text style={[styles.swipeEmptySubtext, { color: colors.textSecondary }]}>Waiting for new skill deals...</Text>
        <View style={styles.skillCooldownProgressContainer}>
          <View style={[styles.cooldownProgressBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.skillCooldownProgressFill,
                { width: `${((SKILL_COOLDOWN_SECONDS - cooldownRemaining) / SKILL_COOLDOWN_SECONDS) * 100}%` }
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.skillSwipeContainer}>
      {nextSkill && (
        <Animated.View style={[styles.skillSwipeCardWrapper, { transform: [{ scale: nextCardScale }] }]}>
          <SkillDealCard skill={nextSkill} colors={colors} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.skillSwipeCardWrapper,
          { transform: [{ translateX: swipeAnim.x }, { rotate }], opacity: opacityAnim },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.swipeOverlay, styles.skipOverlay, { opacity: skipOpacity }]}>
          <X size={24} color="#FFF" />
          <Text style={styles.skipOverlayText}>SKIP</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeOverlay, styles.saveOverlay, { opacity: saveOpacity }]}>
          <Bookmark size={24} color="#FFF" />
          <Text style={styles.saveOverlayText}>SAVE</Text>
        </Animated.View>
        {grabPreviewActive ? (
          <View style={styles.grabbedOverlay} pointerEvents="none">
            <Text style={styles.grabbedOverlayText}>GRABBED</Text>
          </View>
        ) : null}
        <SkillDealCard skill={currentSkill} colors={colors} />
      </Animated.View>

      <View style={styles.skillSwipeActions}>
        <TouchableOpacity
          style={[styles.skillActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => swipeCard('left')}
        >
          <X size={20} color="#EF4444" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.skillGrabBtn} onPress={grabCurrentSkill}>
          <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.skillGrabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.skillGrabText}>Grab</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.skillActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => swipeCard('right')}
        >
          <Bookmark size={20} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.skillSwipeIndicator}>
        {limitedSkills.map((_, i) => (
          <View key={i} style={[styles.swipeDot, { backgroundColor: colors.border }, i === completedCount && currentSkill && styles.skillDotActive, i < completedCount && styles.swipeDotDone]} />
        ))}
      </View>
    </View>
  );
}

function SkillDealCard({ skill, colors }: { skill: SkillDeal; colors: any }) {
  return (
    <View style={[styles.skillDealCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ImageBackground source={{ uri: skill.image }} style={styles.skillDealImage} imageStyle={styles.skillDealImageStyle}>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.skillDealOverlay}>
          <View style={styles.skillDealTimer}>
            <Clock size={12} color="#FFF" />
            <Text style={styles.skillDealTimerText}>{formatCountdown(skill.expiresIn)}</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
      <View style={styles.skillDealContent}>
        <View style={styles.skillDealHeader}>
          <Text style={styles.skillDealIcon}>{skill.icon}</Text>
          <Text style={[styles.skillDealTitle, { color: colors.text }]}>{skill.title}</Text>
        </View>
        <View style={styles.skillDealProvider}>
          <Image source={{ uri: skill.provider.avatar }} style={styles.skillProviderAvatar} />
          <Text style={[styles.skillProviderName, { color: colors.textSecondary }]}>{skill.provider.name}</Text>
          <View style={styles.skillProviderRating}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.skillRatingValue}>{skill.rating}</Text>
          </View>
        </View>
        <View style={styles.skillDealFooter}>
          <View style={styles.skillDealPricing}>
            <Text style={styles.skillDealPrice}>${skill.price}</Text>
            <Text style={styles.skillDealOriginal}>${skill.originalPrice}</Text>
          </View>
          <View style={styles.skillDealDistance}>
            <MapPin size={12} color={colors.textTertiary} />
            <Text style={[styles.skillDistanceText, { color: colors.textTertiary }]}>{skill.distance} mi</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface SwipeableServiceRequestsProps {
  requests: ServiceRequest[];
  onGrab: (request: ServiceRequest) => void;
  onSkip: (request: ServiceRequest) => void;
  onSave: (request: ServiceRequest) => void;
  colors: any;
}

function SwipeableServiceRequests({ requests, onGrab, onSkip, onSave, colors }: SwipeableServiceRequestsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [grabPreviewActive, setGrabPreviewActive] = useState(false);
  const swipeAnim = useRef(new Animated.ValueXY()).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;

  const visibleRequests = useMemo(
    () => requests.filter((request) => !dismissedIds.includes(request.id)),
    [dismissedIds, requests]
  );

  const currentRequest = visibleRequests[0];
  const nextRequest = visibleRequests[1];
  const completedCount = requests.length - visibleRequests.length;

  useEffect(() => {
    setDismissedIds((prev) => prev.filter((id) => requests.some((request) => request.id === id)));
  }, [requests]);

  const resetCard = useCallback(() => {
    swipeAnim.setValue({ x: 0, y: 0 });
    rotateAnim.setValue(0);
    opacityAnim.setValue(1);
    nextCardScale.setValue(0.95);
  }, [swipeAnim, rotateAnim, opacityAnim, nextCardScale]);

  const dismissRequest = useCallback((requestId: string) => {
    setDismissedIds((prev) => (prev.includes(requestId) ? prev : [...prev, requestId]));
  }, []);

  const completeAction = useCallback((action: 'skip' | 'save' | 'grab') => {
    if (!currentRequest) return;

    if (action === 'save') {
      onSave(currentRequest);
    } else if (action === 'skip') {
      onSkip(currentRequest);
    } else {
      onGrab(currentRequest);
    }

    dismissRequest(currentRequest.id);
    resetCard();
  }, [currentRequest, dismissRequest, onGrab, onSave, onSkip, resetCard]);

  const swipeCard = useCallback((direction: 'left' | 'right') => {
    if (grabPreviewActive) return;
    const toValue = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;

    Animated.parallel([
      Animated.timing(swipeAnim.x, { toValue, duration: 250, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.spring(nextCardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start(() => {
      completeAction(direction === 'right' ? 'save' : 'skip');
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [completeAction, grabPreviewActive, swipeAnim.x, opacityAnim, nextCardScale]);

  const grabCurrentRequest = useCallback(() => {
    if (!currentRequest || grabPreviewActive) return;
    setGrabPreviewActive(true);
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(swipeAnim.y, { toValue: -30, duration: 180, useNativeDriver: true }),
        Animated.spring(nextCardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start(() => {
        setGrabPreviewActive(false);
        completeAction('grab');
      });
    }, 800);

    return () => clearTimeout(timeout);
  }, [completeAction, currentRequest, grabPreviewActive, nextCardScale, opacityAnim, swipeAnim.y]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !grabPreviewActive,
    onMoveShouldSetPanResponder: (_, gestureState) => !grabPreviewActive && Math.abs(gestureState.dx) > 2,
    onPanResponderMove: (_, gestureState) => {
      swipeAnim.setValue({ x: gestureState.dx, y: 0 });
      rotateAnim.setValue(gestureState.dx / SCREEN_WIDTH);
      const progress = Math.min(Math.abs(gestureState.dx) / (SCREEN_WIDTH * 0.4), 1);
      nextCardScale.setValue(0.95 + (0.05 * progress));
    },
    onPanResponderRelease: (_, gestureState) => {
      const swipeThreshold = SCREEN_WIDTH * 0.2;
      const velocityThreshold = 0.5;
      const shouldCommitRight = gestureState.dx > swipeThreshold || (gestureState.dx > 20 && gestureState.vx > velocityThreshold);
      const shouldCommitLeft = gestureState.dx < -swipeThreshold || (gestureState.dx < -20 && gestureState.vx < -velocityThreshold);
      if (shouldCommitRight) {
        swipeCard('right');
      } else if (shouldCommitLeft) {
        swipeCard('left');
      } else {
        Animated.parallel([
          Animated.spring(swipeAnim, { toValue: { x: 0, y: 0 }, friction: 8, tension: 100, useNativeDriver: true }),
          Animated.spring(rotateAnim, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
          Animated.spring(nextCardScale, { toValue: 0.95, friction: 8, tension: 100, useNativeDriver: true }),
        ]).start();
      }
    },
  }), [grabPreviewActive, swipeAnim, rotateAnim, nextCardScale, swipeCard]);

  const rotate = rotateAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-10deg', '0deg', '10deg'] });
  const skipOpacity = swipeAnim.x.interpolate({ inputRange: [-SCREEN_WIDTH * 0.3, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const saveOpacity = swipeAnim.x.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.3], outputRange: [0, 1], extrapolate: 'clamp' });

  if (!currentRequest) {
    return (
      <View style={[styles.serviceEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Clock size={36} color="#3B82F6" />
        <Text style={[styles.swipeEmptyText, { color: colors.text }]}>No more requests!</Text>
        <Text style={[styles.swipeEmptySubtext, { color: colors.textSecondary }]}>Check back in a minute for new opportunities.</Text>
      </View>
    );
  }

  return (
    <View style={styles.serviceSwipeContainer}>
      {nextRequest && (
        <Animated.View style={[styles.serviceSwipeCardWrapper, { transform: [{ scale: nextCardScale }] }]}>
          <ServiceRequestCard request={nextRequest} colors={colors} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.serviceSwipeCardWrapper,
          { transform: [{ translateX: swipeAnim.x }, { rotate }], opacity: opacityAnim },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.swipeOverlay, styles.skipOverlay, { opacity: skipOpacity }]}>
          <X size={24} color="#FFF" />
          <Text style={styles.skipOverlayText}>SKIP</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeOverlay, styles.saveOverlay, { opacity: saveOpacity }]}>
          <Bookmark size={24} color="#FFF" />
          <Text style={styles.saveOverlayText}>SAVE</Text>
        </Animated.View>
        {grabPreviewActive ? (
          <View style={styles.grabbedOverlay} pointerEvents="none">
            <Text style={styles.grabbedOverlayText}>GRABBED</Text>
          </View>
        ) : null}
        <ServiceRequestCard request={currentRequest} colors={colors} />
      </Animated.View>

      <View style={styles.serviceSwipeActions}>
        <TouchableOpacity
          style={[styles.serviceActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => swipeCard('left')}
        >
          <X size={20} color="#EF4444" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceGrabBtn} onPress={grabCurrentRequest}>
          <LinearGradient colors={['#3B82F6', '#60A5FA']} style={styles.serviceGrabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.serviceGrabText}>Grab</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.serviceActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => swipeCard('right')}
        >
          <Bookmark size={20} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.serviceSwipeIndicator}>
        {requests.map((_, i) => (
          <View key={i} style={[styles.swipeDot, { backgroundColor: colors.border }, i === completedCount && currentRequest && styles.serviceDotActive, i < completedCount && styles.swipeDotDone]} />
        ))}
      </View>
    </View>
  );
}

function ServiceRequestCard({ request, colors }: { request: ServiceRequest; colors: any }) {
  return (
    <View style={[styles.serviceRequestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ImageBackground source={{ uri: request.image }} style={styles.serviceRequestImage} imageStyle={styles.serviceRequestImageStyle}>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.serviceRequestOverlay}>
          <View style={styles.serviceRequestBadges}>
            <View style={styles.serviceRequestTimer}>
              <Clock size={12} color="#FFF" />
              <Text style={styles.serviceRequestTimerText}>{formatCountdown(request.expiresIn)}</Text>
            </View>
            <View style={styles.serviceRequestCategory}>
              <Text style={styles.serviceRequestCategoryText}>{request.category}</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
      <View style={styles.serviceRequestContent}>
        <Text style={[styles.serviceRequestTitle, { color: colors.text }]}>{request.title}</Text>
        <Text style={[styles.serviceRequestDesc, { color: colors.textSecondary }]} numberOfLines={2}>{request.description}</Text>
        <View style={styles.serviceRequestRequester}>
          <Image source={{ uri: request.requester.avatar }} style={styles.requesterAvatar} />
          <View style={styles.requesterInfo}>
            <Text style={[styles.requesterName, { color: colors.text }]}>{request.requester.name}</Text>
            <View style={styles.requesterRating}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.requesterRatingText}>{request.requester.rating}</Text>
            </View>
          </View>
        </View>
        <View style={styles.serviceRequestFooter}>
          <View style={styles.serviceRequestBudget}>
            <Text style={styles.budgetLabel}>Budget</Text>
            <Text style={styles.budgetAmount}>${request.budget}</Text>
          </View>
          <View style={styles.serviceRequestDistance}>
            <MapPin size={12} color={colors.textTertiary} />
            <Text style={[styles.serviceDistanceText, { color: colors.textTertiary }]}>{request.distance} mi</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ConfettiModal({ visible, amount, onClose }: ConfettiModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
      setTimeout(onClose, 2000);
    } else {
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
    }
  }, [visible, scaleAnim, rotateAnim, onClose]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.confettiOverlay}>
        <Animated.View style={[styles.confettiContent, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Trophy size={60} color="#7B61FF" />
          </Animated.View>
          <Text style={styles.confettiTitle}>🎉 GRABBED!</Text>
          <Text style={styles.confettiAmount}>+${amount} value</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const { plans } = usePlanner();
  const { sendMessage } = useMessaging();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [liveUpdateIndex, setLiveUpdateIndex] = useState(0);
  const [bundleSetIndex, setBundleSetIndex] = useState(0);
  const [savedBundles, setSavedBundles] = useState<BundlePlan[]>([]);
  const [savedSkills, setSavedSkills] = useState<SkillDeal[]>([]);
  const [savedRequests, setSavedRequests] = useState<ServiceRequest[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiAmount, setConfettiAmount] = useState(0);

  // ─── Create Deal Modal State ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'skill' | 'bundle'>('skill');
  const [dealTitle, setDealTitle] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealPrice, setDealPrice] = useState('');
  const [dealIcon, setDealIcon] = useState('🛠️');
  const [dealImage, setDealImage] = useState<string | null>(null);
  const [dealItems, setDealItems] = useState<string[]>([]);
  const [dealItemText, setDealItemText] = useState('');
  const [createdSkills, setCreatedSkills] = useState<SkillDeal[]>([]);
  const [createdBundles, setCreatedBundles] = useState<BundlePlan[]>([]);

  const updateAnim = useRef(new Animated.Value(0)).current;

  const { data: grabbedBundles } = useQuery<GrabbedBundle[]>({
    queryKey: ['grabbedBundles', user?.id],
    queryFn: async ({ signal }) => {
      if (!user?.id) return [];
      console.log('Grid load:', ['grabbedBundles']);

      try {
        const { data, error } = await withAbortSignal(
          supabase
            .from('job_requests')
            .select('id, title, proposed_budget, pickup_time, status, booked_at, plan_details')
            .eq('user_id', user.id)
            .eq('type', 'plan_for_hire')
            .order('booked_at', { ascending: false }),
          signal
        );

        if (error) {
          if (isAbortError(error)) {
            logAbort('[GrabbedBundles]');
            return [];
          }
          console.error('Grabbed bundles error:', error);
          return [];
        }

        return data || [];
      } catch (e: any) {
        if (isAbortError(e)) {
          logAbort('[GrabbedBundles]');
          return [];
        }
        return [];
      }
    },
    enabled: isAuthenticated,
  });

  const currentBundleSet = CAROUSEL_SETS.bundles[bundleSetIndex];

  useEffect(() => {
    console.log('Grid load:', {
      bundles: currentBundleSet.key,
      grabbedCount: grabbedBundles?.length || 0,
    });
  }, [currentBundleSet.key, grabbedBundles?.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(updateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(updateAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setLiveUpdateIndex(prev => (prev + 1) % LIVE_UPDATES.length);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [updateAnim]);

  const currentUpdate = LIVE_UPDATES[liveUpdateIndex];

  const handleGrabBundle = useCallback((bundle: BundlePlan) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    console.log('Card action:', 'grab_bundle', bundle.id);
    setConfettiAmount(bundle.price);
    setShowConfetti(true);
    // Create conversation with bundle creator
    sendMessage(bundle.creatorId || 'u-2', `👋 Hey! I'm interested in your bundle "${bundle.title}" for $${bundle.price}. Is it still available?`);
  }, [sendMessage]);

  const handleSkipBundle = useCallback((bundle: BundlePlan) => {
    console.log('Card action:', 'skip_bundle', bundle.id);
  }, []);

  const handleSaveBundle = useCallback((bundle: BundlePlan) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('Card action:', 'save_bundle', bundle.id);
    setSavedBundles(prev => [...prev, bundle]);
  }, []);

  const handleGrabSkill = useCallback((skill: SkillDeal) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    console.log('Card action:', 'grab_skill', skill.id);
    setConfettiAmount(skill.price);
    setShowConfetti(true);
    sendMessage(skill.creatorId || 'u-3', `💪 Interested in your "${skill.title}" skill offer for $${skill.price}. Let's connect!`);
  }, [sendMessage]);

  const handleSkipSkill = useCallback((skill: SkillDeal) => {
    console.log('Card action:', 'skip_skill', skill.id);
  }, []);

  const handleSaveSkill = useCallback((skill: SkillDeal) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('Card action:', 'save_skill', skill.id);
    setSavedSkills(prev => [...prev, skill]);
  }, []);

  const handleGrabRequest = useCallback((request: ServiceRequest) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    console.log('Card action:', 'grab_request', request.id);
    setConfettiAmount(request.budget);
    setShowConfetti(true);
    sendMessage(request.creatorId || 'u-4', `🛠️ Hey! I can help with "${request.title}". My budget is $${request.budget}. Still looking?`);
  }, [sendMessage]);

  const handleSkipRequest = useCallback((request: ServiceRequest) => {
    console.log('Card action:', 'skip_request', request.id);
  }, []);

  const handleSaveRequest = useCallback((request: ServiceRequest) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('Card action:', 'save_request', request.id);
    setSavedRequests(prev => [...prev, request]);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    queryClient.invalidateQueries({ queryKey: ['grabbedBundles'] });
    console.log('Grid load:', 'refresh');
    setTimeout(() => setRefreshing(false), 1500);
  }, [queryClient]);

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    handleTabBarScroll(event.nativeEvent.contentOffset.y);
  };

  const handleNavigate = (route: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(route as never);
  };

  const myGrabbedBundles: BundlePlan[] = useMemo(() => {
    if (!grabbedBundles?.length) return [];
    return grabbedBundles.map(b => ({
      id: b.id,
      title: b.title,
      price: b.proposed_budget,
      items: b.plan_details?.items?.length || 1,
      type: 'grabbed',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      distance: 0,
      status: 'grabbed' as const,
      bookedAt: b.booked_at,
      pickupTime: b.pickup_time || undefined,
    }));
  }, [grabbedBundles]);

  const allBundles = useMemo(() => {
    return [...currentBundleSet.data, ...myGrabbedBundles, ...createdBundles];
  }, [currentBundleSet.data, myGrabbedBundles, createdBundles]);

  const allSkills = useMemo(() => {
    return [...MOCK_SKILL_DEALS, ...createdSkills];
  }, [createdSkills]);

  // ─── Create Handlers ───
  const resetDealForm = () => {
    setDealTitle('');
    setDealDesc('');
    setDealPrice('');
    setDealIcon('🛠️');
    setDealImage(null);
    setDealItems([]);
    setDealItemText('');
  };

  const pickDealImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setDealImage(result.assets[0].uri);
    }
  };

  const handleCreateDeal = async () => {
    if (!dealTitle.trim()) {
      Alert.alert('Missing', 'Please enter a title.');
      return;
    }
    const price = parseFloat(dealPrice) || 0;
    const userInfo = {
      id: user?.id || 'u-dev',
      name: user?.fullName || 'You',
      avatar: user?.avatar || 'https://i.pravatar.cc/150?u=me',
    };

    if (createMode === 'skill') {
      const newSkill: SkillDeal = {
        id: `skill-${Date.now()}`,
        creatorId: userInfo.id,
        creatorName: userInfo.name,
        creatorAvatar: userInfo.avatar,
        title: dealTitle.trim(),
        description: dealDesc.trim(),
        price,
        originalPrice: price,
        rating: 5.0,
        image: dealImage || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
        distance: 0,
        expiresIn: 0,
        icon: dealIcon,
        imageUrl: dealImage || undefined,
        category: 'Skill',
        grabCount: 0,
        provider: { name: userInfo.name, avatar: userInfo.avatar },
      };
      setCreatedSkills(prev => [newSkill, ...prev]);
      try { await localApi.createSkillDeal({ creator_id: userInfo.id, creator_name: userInfo.name, creator_avatar: userInfo.avatar, title: dealTitle.trim(), description: dealDesc.trim(), price, icon: dealIcon, image_url: dealImage || undefined, category: 'Skill' }); } catch {}
    } else {
      const newBundle: BundlePlan = {
        id: `bundle-${Date.now()}`,
        creatorId: userInfo.id,
        creatorName: userInfo.name,
        creatorAvatar: userInfo.avatar,
        title: dealTitle.trim(),
        description: dealDesc.trim(),
        price,
        image: dealImage || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
        imageUrl: dealImage || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
        items: dealItems,
        type: 'Bundle',
        distance: 0,
        status: 'available',
        category: 'Bundle',
        grabCount: 0,
        location: 'Created by you',
      };
      setCreatedBundles(prev => [newBundle, ...prev]);
      try { await localApi.createBundle({ creator_id: userInfo.id, creator_name: userInfo.name, creator_avatar: userInfo.avatar, title: dealTitle.trim(), description: dealDesc.trim(), price, items: dealItems, image_url: dealImage || undefined, category: 'Bundle' }); } catch {}
    }

    resetDealForm();
    setShowCreateModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <View style={styles.headerMain}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Sparkles size={18} color="#FFF" />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>Apparently</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.8}
            >
              <Plus size={20} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleNavigate('/(tabs)/inbox')}
              activeOpacity={0.8}
            >
              <MessageCircle size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleNavigate('/(tabs)/manage')}
              activeOpacity={0.8}
            >
              <BarChart3 size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View
          style={[
            styles.liveTicker,
            { backgroundColor: colors.surface, borderColor: colors.border },
            { opacity: updateAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 1] }) }
          ]}
        >
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={[styles.tickerText, { color: colors.textSecondary }]}>
            {currentUpdate.name} {currentUpdate.action} ${currentUpdate.amount} {currentUpdate.service} - {currentUpdate.time}
          </Text>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <TouchableOpacity
          style={styles.planDayCard}
          onPress={() => handleNavigate('/(tabs)/planner')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#7B61FF', '#A78BFA']}
            style={styles.planDayGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.planDayContent}>
              <View style={styles.planDayIcon}>
                <Calendar size={24} color="#FFF" />
              </View>
              <View style={styles.planDayTextContent}>
                <Text style={styles.planDayTitle}>Plan Your Day</Text>
                <Text style={styles.planDaySubtitle}>{plans.length} plans ready</Text>
              </View>
            </View>
            <ArrowRight size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.lifestyleSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Heart size={20} color="#EC4899" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Lifestyle</Text>
            </View>
            <TouchableOpacity onPress={() => handleNavigate('/(tabs)/book')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lifestyleScroll}
          >
            {LIFESTYLE_CATEGORIES.map((category) => {
              const IconComponent = category.icon;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.lifestyleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => handleNavigate('/(tabs)/book')}
                >
                  <ImageBackground
                    source={{ uri: category.image }}
                    style={styles.lifestyleCardImage}
                    imageStyle={styles.lifestyleCardImageStyle}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.lifestyleCardOverlay}
                    >
                      <View style={[styles.lifestyleCategoryIcon, { backgroundColor: category.color }]}>
                        <IconComponent size={16} color="#FFF" />
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                  <View style={styles.lifestyleCardContent}>
                    <Text style={[styles.lifestyleCardTitle, { color: colors.text }]}>{category.title}</Text>
                    <Text style={[styles.lifestyleCardCount, { color: colors.textTertiary }]}>{category.count} options</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.bundleSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Gift size={20} color="#7B61FF" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Bundles</Text>
            </View>
            <View style={styles.bundleTabs}>
              {CAROUSEL_SETS.bundles.map((set, i) => (
                <TouchableOpacity
                  key={set.key}
                  style={[
                    styles.bundleTab,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    i === bundleSetIndex && styles.bundleTabActive
                  ]}
                  onPress={() => setBundleSetIndex(i)}
                >
                  <Text style={[
                    styles.bundleTabText,
                    { color: colors.textTertiary },
                    i === bundleSetIndex && styles.bundleTabTextActive
                  ]}>
                    {set.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {savedBundles.length > 0 && (
                <View style={styles.savedBundleBadge}>
                  <Bookmark size={10} color="#FFF" />
                  <Text style={styles.savedBundleBadgeText}>{savedBundles.length}</Text>
                </View>
              )}
            </View>
          </View>

          <SwipeableBundles
            bundles={allBundles}
            onGrab={handleGrabBundle}
            onSkip={handleSkipBundle}
            onSave={handleSaveBundle}
            colors={colors}
          />
        </View>

        <View style={styles.skillsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Wrench size={20} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Skill Deals</Text>
            </View>
            {savedSkills.length > 0 && (
              <View style={styles.savedSkillBadge}>
                <Bookmark size={10} color="#FFF" />
                <Text style={styles.savedSkillBadgeText}>{savedSkills.length}</Text>
              </View>
            )}
          </View>
          <SwipeableSkills
            skills={allSkills}
            onGrab={handleGrabSkill}
            onSkip={handleSkipSkill}
            onSave={handleSaveSkill}
            colors={colors}
          />
        </View>

        <View style={styles.serviceRequestsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Briefcase size={20} color="#3B82F6" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Requests</Text>
            </View>
            {savedRequests.length > 0 && (
              <View style={styles.savedRequestBadge}>
                <Bookmark size={10} color="#FFF" />
                <Text style={styles.savedRequestBadgeText}>{savedRequests.length}</Text>
              </View>
            )}
          </View>
          <SwipeableServiceRequests
            requests={MOCK_SERVICE_REQUESTS}
            onGrab={handleGrabRequest}
            onSkip={handleSkipRequest}
            onSave={handleSaveRequest}
            colors={colors}
          />
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* CreateDealModal */}
      <Modal visible={showCreateModal} animationType="slide" transparent statusBarTranslucent>
        <View style={creatDealModalStyles.backdrop}>
          <View style={[creatDealModalStyles.sheet, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={creatDealModalStyles.sheetHeader}>
              <Text style={[creatDealModalStyles.sheetTitle, { color: colors.text }]}>
                Create {createMode === 'skill' ? 'Skill Deal' : 'Bundle'}
              </Text>
              <TouchableOpacity onPress={() => { resetDealForm(); setShowCreateModal(false); }}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Mode Toggle */}
            <View style={creatDealModalStyles.modeToggle}>
              <TouchableOpacity
                style={[creatDealModalStyles.modeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, createMode === 'skill' && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                onPress={() => setCreateMode('skill')}
              >
                <Wrench size={15} color={createMode === 'skill' ? colors.accent : colors.textSecondary} />
                <Text style={[creatDealModalStyles.modeBtnText, { color: createMode === 'skill' ? colors.accent : colors.textSecondary }]}>Skill</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[creatDealModalStyles.modeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, createMode === 'bundle' && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                onPress={() => setCreateMode('bundle')}
              >
                <Gift size={15} color={createMode === 'bundle' ? colors.accent : colors.textSecondary} />
                <Text style={[creatDealModalStyles.modeBtnText, { color: createMode === 'bundle' ? colors.accent : colors.textSecondary }]}>Bundle</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={creatDealModalStyles.form} showsVerticalScrollIndicator={false}>
              {/* Image */}
              <TouchableOpacity style={[creatDealModalStyles.imgPicker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickDealImage}>
                {dealImage ? (
                  <Image source={{ uri: dealImage }} style={creatDealModalStyles.previewImg} />
                ) : (
                  <>
                    <ImagePlus size={28} color={colors.textTertiary} />
                    <Text style={[creatDealModalStyles.imgPickerText, { color: colors.textTertiary }]}>Add image</Text>
                  </>
                )}
                {dealImage && (
                  <TouchableOpacity style={creatDealModalStyles.removeImg} onPress={() => setDealImage(null)}>
                    <X size={12} color="#FFF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Title */}
              <TextInput
                style={[creatDealModalStyles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder={createMode === 'skill' ? 'What skill are you offering?' : 'Name your bundle'}
                placeholderTextColor={colors.textTertiary}
                value={dealTitle}
                onChangeText={setDealTitle}
              />

              {/* Description */}
              <TextInput
                style={[creatDealModalStyles.input, creatDealModalStyles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Describe what's included..."
                placeholderTextColor={colors.textTertiary}
                value={dealDesc}
                onChangeText={setDealDesc}
                multiline
                numberOfLines={3}
              />

              {/* Price */}
              <View style={creatDealModalStyles.priceRow}>
                <Text style={[creatDealModalStyles.priceLabel, { color: colors.textSecondary }]}>$</Text>
                <TextInput
                  style={[creatDealModalStyles.priceInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  value={dealPrice}
                  onChangeText={setDealPrice}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Bundle items */}
              {createMode === 'bundle' && (
                <View style={creatDealModalStyles.itemsSection}>
                  <Text style={[creatDealModalStyles.itemsLabel, { color: colors.textSecondary }]}>Bundle Items</Text>
                  <View style={creatDealModalStyles.addItemRow}>
                    <TextInput
                      style={[creatDealModalStyles.itemInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. Hotel room, Dinner, Chauffeur..."
                      placeholderTextColor={colors.textTertiary}
                      value={dealItemText}
                      onChangeText={setDealItemText}
                      onSubmitEditing={() => {
                        if (dealItemText.trim()) {
                          setDealItems(prev => [...prev, dealItemText.trim()]);
                          setDealItemText('');
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={[creatDealModalStyles.addItemBtn, { backgroundColor: colors.accent }]}
                      onPress={() => {
                        if (dealItemText.trim()) {
                          setDealItems(prev => [...prev, dealItemText.trim()]);
                          setDealItemText('');
                        }
                      }}
                    >
                      <Plus size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  {dealItems.map((item, i) => (
                    <View key={i} style={[creatDealModalStyles.itemTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[creatDealModalStyles.itemTagText, { color: colors.text }]}>{item}</Text>
                      <TouchableOpacity onPress={() => setDealItems(prev => prev.filter((_, idx) => idx !== i))}>
                        <X size={12} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Post Button */}
            <TouchableOpacity
              style={[creatDealModalStyles.postBtn, !dealTitle.trim() && { opacity: 0.5 }, { backgroundColor: colors.accent }]}
              onPress={handleCreateDeal}
              disabled={!dealTitle.trim()}
            >
              <Text style={creatDealModalStyles.postBtnText}>
                Post {createMode === 'skill' ? 'Skill Deal' : 'Bundle'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfettiModal
        visible={showConfetti}
        amount={confettiAmount}
        onClose={() => setShowConfetti(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  liveTicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#10B981',
    letterSpacing: 0.5,
  },
  tickerText: {
    fontSize: 13,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  planDayCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  planDayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  planDayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  planDayIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planDayTextContent: {
    gap: 2,
  },
  planDayTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  planDaySubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  lifestyleSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#7B61FF',
  },
  lifestyleScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  lifestyleCard: {
    width: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  lifestyleCardImage: {
    height: 100,
  },
  lifestyleCardImageStyle: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  lifestyleCardOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  lifestyleCategoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleCardContent: {
    padding: 12,
  },
  lifestyleCardTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  lifestyleCardCount: {
    fontSize: 12,
  },
  bundleSection: {
    marginBottom: 28,
  },
  bundleTabs: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  bundleTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  bundleTabActive: {
    backgroundColor: '#7B61FF',
    borderColor: '#7B61FF',
  },
  bundleTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  bundleTabTextActive: {
    color: '#FFF',
  },
  savedBundleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  savedBundleBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  swipeContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    height: 480,
  },
  swipeCardWrapper: {
    width: SCREEN_WIDTH - 40,
    position: 'absolute',
    top: 0,
  },
  bundleCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  bundleCardImage: {
    height: 160,
  },
  bundleCardImageStyle: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bundleImageOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  bundleTypeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bundleTypeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  bundleCardContent: {
    padding: 16,
  },
  bundleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bundleCardTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    flex: 1,
    marginRight: 12,
  },
  bundleItemsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bundleItemsText: {
    fontSize: 13,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  creatorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  reviewsText: {
    fontSize: 12,
  },
  bundleSummaryBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  bundleSummaryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bundleCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bundlePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bundlePrice: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#7B61FF',
  },
  bundlePriceLabel: {
    fontSize: 14,
  },
  bundleDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bundleDistanceText: {
    fontSize: 13,
  },
  swipeOverlay: {
    position: 'absolute',
    top: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  skipOverlay: {
    right: 16,
    backgroundColor: '#EF4444',
  },
  saveOverlay: {
    left: 16,
    backgroundColor: '#10B981',
  },
  skipOverlayText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  saveOverlayText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  grabbedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  grabbedOverlayText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900' as const,
    letterSpacing: 1.2,
  },
  swipeHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  swipeHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 390,
    paddingTop: 16,
  },
  swipeActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  swipeGrabBtn: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  grabGradient: {
    width: 100,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  swipeGrabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  swipeIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  swipeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swipeDotActive: {
    backgroundColor: '#7B61FF',
    width: 24,
  },
  swipeDotDone: {
    backgroundColor: '#10B981',
  },
  swipeEmptyState: {
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 24,
  },
  swipeEmptyText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  swipeEmptySubtext: {
    fontSize: 14,
    textAlign: 'center' as const,
  },
  cooldownIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123, 97, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cooldownTimer: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  cooldownProgressContainer: {
    width: '100%',
    marginTop: 16,
  },
  cooldownProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cooldownProgressFill: {
    height: '100%',
    backgroundColor: '#7B61FF',
    borderRadius: 3,
  },
  skillsSection: {
    marginBottom: 28,
  },
  skillSwipeContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    height: 320,
  },
  skillSwipeCardWrapper: {
    width: SCREEN_WIDTH - 40,
    position: 'absolute',
    top: 0,
  },
  skillDealCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  skillDealImage: {
    height: 120,
  },
  skillDealImageStyle: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  skillDealOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: 12,
    alignItems: 'flex-end',
  },
  skillDealTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  skillDealTimerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  skillDealContent: {
    padding: 14,
  },
  skillDealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  skillDealIcon: {
    fontSize: 24,
  },
  skillDealTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  skillDealProvider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  skillProviderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  skillProviderName: {
    fontSize: 13,
    flex: 1,
  },
  skillProviderRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skillRatingValue: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  skillDealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillDealPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  skillDealPrice: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#F59E0B',
  },
  skillDealOriginal: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through' as const,
  },
  skillDealDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skillDistanceText: {
    fontSize: 12,
  },
  skillSwipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 245,
    paddingTop: 12,
  },
  skillActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  skillGrabBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  skillGrabGradient: {
    width: 80,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillGrabText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  skillSwipeIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  skillDotActive: {
    backgroundColor: '#F59E0B',
    width: 24,
  },
  skillEmptyState: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 24,
  },
  skillCooldownIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  skillCooldownTimer: {
    fontSize: 40,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  skillCooldownProgressContainer: {
    width: '100%',
    marginTop: 12,
  },
  skillCooldownProgressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  savedSkillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  savedSkillBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  serviceRequestsSection: {
    marginBottom: 28,
  },
  serviceSwipeContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    height: 420,
  },
  serviceSwipeCardWrapper: {
    width: SCREEN_WIDTH - 40,
    position: 'absolute',
    top: 0,
  },
  serviceRequestCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  serviceRequestImage: {
    height: 140,
  },
  serviceRequestImageStyle: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  serviceRequestOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: 12,
  },
  serviceRequestBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceRequestTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  serviceRequestTimerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  serviceRequestCategory: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  serviceRequestCategoryText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  serviceRequestContent: {
    padding: 16,
  },
  serviceRequestTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  serviceRequestDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  serviceRequestRequester: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  requesterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  requesterInfo: {
    flex: 1,
  },
  requesterName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  requesterRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requesterRatingText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  serviceRequestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceRequestBudget: {
    gap: 2,
  },
  budgetLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  budgetAmount: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#3B82F6',
  },
  serviceRequestDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceDistanceText: {
    fontSize: 12,
  },
  serviceSwipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 335,
    paddingTop: 12,
  },
  serviceActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  serviceGrabBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  serviceGrabGradient: {
    width: 80,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceGrabText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  serviceSwipeIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  serviceDotActive: {
    backgroundColor: '#3B82F6',
    width: 24,
  },
  serviceEmptyState: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    gap: 10,
  },
  savedRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  savedRequestBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  bottomSpacing: {
    height: 40,
  },
  confettiOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiContent: {
    alignItems: 'center',
    gap: 16,
  },
  confettiTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800' as const,
  },
  confettiAmount: {
    color: '#7B61FF',
    fontSize: 24,
    fontWeight: '700' as const,
  },
});

const creatDealModalStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  form: { paddingHorizontal: 20 },
  imgPicker: { height: 140, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%', borderRadius: 14 },
  imgPickerText: { fontSize: 13, marginTop: 6 },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  input: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, marginBottom: 10 },
  textArea: { height: 80, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  priceLabel: { fontSize: 22, fontWeight: '700' },
  priceInput: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 22, fontWeight: '700' },
  itemsSection: { marginBottom: 10 },
  itemsLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  addItemRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  itemInput: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14 },
  addItemBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  itemTagText: { fontSize: 14 },
  postBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  postBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  createBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manageLink: { fontSize: 12, fontWeight: '600' },
});
