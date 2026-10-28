import {
  MapPin, Sparkles, Dumbbell, Utensils, Palette,
  Plane, Heart, Music, Play, Plus,
   Wrench, Bookmark,
  FileText, X, Send, ChevronLeft,
  ShoppingBag, Home, Repeat, UserPlus, Search, Package,
  MessageCircle, MoreHorizontal, Volume2, VolumeX, Camera, Users
} from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image as RNImage,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useTabBar } from '@/contexts/TabBarContext';
import InstagramCamera, { type CapturedMedia } from '@/components/InstagramCamera';
import StoriesViewer, { type StoryUser, type StoryMedia } from '@/components/StoriesViewer';
import StoryRing from '@/components/StoryRing';
import CreateStory from '@/components/CreateStory';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

import { useSocial } from '@/contexts/SocialContext';
import { useUserPosts } from '@/contexts/UserPostsContext';
import SkeletonCard from '@/components/SkeletonCard';
import PostComposer, { POST_CATEGORIES as POST_CATS } from '@/components/PostComposer';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import PostLiveLayer from '@/components/PostLiveLayer';
import AppVideo from '@/components/AppVideo';
import HeaderActivityButtons from '@/components/HeaderActivityButtons';
import CommentsPanel from '@/components/comments/CommentsPanel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Reels-style 9:16 portrait container (1080×1920 proportions)
const FEED_ASPECT = 9 / 16; // width:height
const FEED_MEDIA_HEIGHT = Math.round(SCREEN_WIDTH / FEED_ASPECT);
// Floating top bar (stories + actions) that hovers over the feed
const STORY_SIZE = 40;
const FLOAT_BAR_HEIGHT = 52; // below the status bar

// ── Types ──────────────────────────────────────────────────────────────────

type PostType = 'text' | 'photo' | 'video';

interface Comment {
  id: string;
  user: { name: string; avatar: string; userId?: string };
  text: string;
  timestamp: string;
}

interface FeedPost {
  id: string;
  type: PostType;
  author: { name: string; avatar: string; userId?: string };
  category: string;
  timestamp: string;
  caption: string;
  media?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  location?: string;
  tags: string[];
  likes: number;
  stats: { saves: number; comments: number };
  videoUrl?: string;
  authorId?: string;
  comments_list?: Comment[];
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  Wellness: { icon: Heart, color: '#EC4899', bg: '#EC489915' },
  Fitness: { icon: Dumbbell, color: '#F97316', bg: '#F9731615' },
  Entertainment: { icon: Music, color: '#8B5CF6', bg: '#8B5CF615' },
  Creative: { icon: Palette, color: '#06B6D4', bg: '#06B6D415' },
  Dining: { icon: Utensils, color: '#EF4444', bg: '#EF444415' },
  Travel: { icon: Plane, color: '#10B981', bg: '#10B98115' },
  Services: { icon: Wrench, color: '#6366F1', bg: '#6366F115' },
  Marketplace: { icon: ShoppingBag, color: '#10B981', bg: '#10B98115' },
  Rentals: { icon: Home, color: '#3B82F6', bg: '#3B82F615' },
  Swaps: { icon: Repeat, color: '#F59E0B', bg: '#F59E0B15' },
  Connections: { icon: UserPlus, color: '#8B5CF6', bg: '#8B5CF615' },
  Requests: { icon: Search, color: '#F59E0B', bg: '#F59E0B15' },
  Bundles: { icon: Package, color: '#8B5CF6', bg: '#8B5CF615' },
};

// All mock data removed — feed is live-only from Supabase + user posts

// ── Time helpers ──
function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === 'Just now') return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return dateStr;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Post Detail Modal
// ═══════════════════════════════════════════════════════════════════════════

function Avatar({ uri, name, size, colors }: { uri?: string; name?: string; size: number; colors: any }) {
  if (uri) return <RNImage source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent + '30', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

function PostDetailModal({
  post,
  visible,
  onClose,
  colors,
  onSave,
  isSaved,
  onPlayVideo,
  onOpenProfile,
}: {
  post: FeedPost;
  visible: boolean;
  onClose: () => void;
  colors: any;
  onSave: (postId: string) => void;
  isSaved: boolean;
  onPlayVideo?: (uri: string) => void;
  onOpenProfile: (userId?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { interactions, toggleLike } = useSocial();
  const interaction = interactions[post.id];
  const liked = interaction?.isLiked ?? false;
  const likeCount = interaction?.likeCount ?? post.likes ?? 0;
  const isVideo = post.type === 'video' && !!post.videoUrl;
  const ownerId = post.authorId || post.author.userId || null;

  const postHeader = (
    <View style={styles.modalContent}>
      <TouchableOpacity style={styles.modalAuthorRow} onPress={() => onOpenProfile(post.author.userId)}>
        <Avatar uri={post.author.avatar} name={post.author.name} size={40} colors={colors} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.authorName, { color: colors.text }]}>{post.author.name}</Text>
          <Text style={[styles.metaSub, { color: colors.textTertiary }]}>
            {timeAgo(post.timestamp)}{post.location ? ` · ${post.location}` : ''}
          </Text>
        </View>
      </TouchableOpacity>

      {post.media ? (
        <View style={[styles.mediaWrap, { marginTop: 12, backgroundColor: '#000' }]}>
          {isVideo ? (
            <AppVideo source={{ uri: post.videoUrl }} style={[styles.modalMedia, { height: 420, marginTop: 0 }]} resizeMode="contain" shouldPlay isLooping useNativeControls />
          ) : (
            <TouchableOpacity activeOpacity={0.95} onPress={() => onPlayVideo?.(post.media!)}>
              <RNImage source={{ uri: post.media }} style={[styles.modalMedia, { height: 420, marginTop: 0 }]} resizeMode="cover" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {post.caption ? (
        <Text style={[styles.caption, { color: colors.text, marginTop: 12, fontSize: 15 }]}>{post.caption}</Text>
      ) : null}

      <View style={[styles.detailActions, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.detailActionBtn}
          onPress={() => { toggleLike(post.id, post.likes ?? 0); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={24} color={liked ? '#FF3040' : colors.text} fill={liked ? '#FF3040' : 'none'} />
        </TouchableOpacity>
        <Text style={[styles.detailCount, { color: colors.text }]}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.detailActionBtn} onPress={() => onSave(post.id)} accessibilityLabel={isSaved ? 'Unsave' : 'Save'}>
          <Bookmark size={24} color={colors.text} fill={isSaved ? colors.text : 'none'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalBackBtn} accessibilityLabel="Close">
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Post</Text>
          <View style={{ width: 40 }} />
        </View>

        <CommentsPanel
          postId={post.id}
          postOwnerId={ownerId}
          colors={colors}
          enabled={visible}
          header={postHeader}
          showCountLabel
          onOpenProfile={onOpenProfile}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Post Card Component
// ═══════════════════════════════════════════════════════════════════════════

function PostCard({
  post,
  colors,
  onPress,
  onSave,
  onComment,
  onMediaTap,
  onShare,
  onDelete,
  onReport,
  onHide,
  isSaved: isSavedProp,
  height,
  isActive,
  muted,
  onToggleMute,
  topOffset = 0,
}: {
  post: FeedPost;
  colors: any;
  onPress: () => void;
  onSave: (postId: string) => void;
  onComment: (post: FeedPost) => void;
  onTagTap?: (tag: string) => void;
  onMediaTap: (uri: string, isVideo?: boolean) => void;
  onShare: (post: FeedPost) => void;
  onDelete?: (postId: string) => void;
  onReport: (postId: string) => void;
  onHide: (postId: string) => void;
  isSaved?: boolean;
  height?: number;
  isActive?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /** Space taken by the floating top bar (keeps overlays below it). */
  topOffset?: number;
}) {
  const saved = !!isSavedProp;
  const { interactions, toggleLike } = useSocial();
  const interaction = interactions[post.id];
  const liked = interaction?.isLiked ?? false;
  const likeCount = interaction?.likeCount ?? (post.likes ?? 0);
  const commentCount = interaction?.commentCount ?? post.stats.comments ?? 0;
  const authorAvatar = post.author.avatar || '';
  const { user: currentUser } = useAuth();
  const routerFromCard = useRouter();
  const isVideo = post.type === 'video' && !!post.videoUrl;
  // The tab bar floats over the bottom of each full-screen post.
  const cardInsets = useSafeAreaInsets();
  const tabBarSpace = (Platform.OS === 'ios' ? 56 : 52) + Math.max(cardInsets.bottom, 0);

  // ── Double-tap to like (Instagram): big heart pops over the media ──
  const burst = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (singleTapTimer.current) clearTimeout(singleTapTimer.current); }, []);

  const playBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }),
      Animated.delay(350),
      Animated.timing(burst, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      // Double-tap only ever likes — it never un-likes.
      if (!liked) toggleLike(post.id, post.likes ?? 0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playBurst();
      return;
    }
    lastTap.current = now;
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      // Single tap: videos toggle sound (Reels), photos open full screen.
      if (isVideo) onToggleMute();
      else onMediaTap(post.media!, false);
    }, 280);
  };

  const handleSave = () => {
    onSave(post.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLike = () => {
    toggleLike(post.id, post.likes ?? 0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isOwnPost = !!(currentUser?.id && post.author.userId === currentUser.id);
    const options: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [];
    if (isOwnPost) {
      options.push({
        text: 'Delete Post',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Delete Post',
            'Are you sure you want to delete this post? This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(post.id) },
            ],
            { cancelable: true },
          );
        },
      });
    } else {
      options.push({ text: 'Report', style: 'destructive', onPress: () => onReport(post.id) });
      // Hide is for other people's posts (removes it from your feed).
      options.push({ text: 'Hide', onPress: () => onHide(post.id) });
    }
    options.push({ text: 'Share', onPress: () => onShare(post) });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post Options', `By ${post.author.name}`, options, { cancelable: true });
  };

  const handleProfileTap = () => {
    if (!post.author.userId) return;
    if (post.author.userId === currentUser?.id) {
      routerFromCard.push('/(tabs)/profile' as any);
    } else {
      routerFromCard.push(`/user/${post.author.userId}` as any);
    }
  };

  const burstStyle = {
    opacity: burst,
    transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  };

  return (
    <View style={[igCardStyles.card, { backgroundColor: post.media ? '#000' : colors.surface, height: height ?? undefined, marginBottom: height ? 0 : 16 }]}>
      {post.media ? (
        <View style={height ? { flex: 1 } : undefined}>
          <Pressable onPress={handleMediaPress} style={height ? { flex: 1 } : undefined} accessibilityLabel={isVideo ? 'Video. Double tap to like, tap to mute or unmute' : 'Photo. Double tap to like, tap to view'}>
            {isVideo ? (
              isActive ? (
                <AppVideo
                  source={{ uri: post.videoUrl }}
                  style={[igCardStyles.media, height ? { width: '100%', height: '100%' } : { height: FEED_MEDIA_HEIGHT }]}
                  resizeMode="cover"
                  shouldPlay
                  isLooping
                  isMuted={muted}
                />
              ) : (
                // Off-screen videos don't hold a player (saves memory/battery).
                <View style={[igCardStyles.media, height ? { width: '100%', height: '100%' } : { height: FEED_MEDIA_HEIGHT }]} />
              )
            ) : (
              <RNImage
                source={{ uri: post.media }}
                style={[igCardStyles.media, height ? { width: '100%', height: '100%' } : { height: FEED_MEDIA_HEIGHT }]}
                resizeMode="cover"
              />
            )}
            {isVideo && !isActive ? (
              <View style={igCardStyles.playOverlay} pointerEvents="none">
                <View style={igCardStyles.playBtn}>
                  <Play size={22} color="#FFF" fill="#FFF" style={{ marginLeft: 3 }} />
                </View>
              </View>
            ) : null}
            <Animated.View style={[igCardStyles.playOverlay, burstStyle]} pointerEvents="none">
              <Heart size={96} color="#FFFFFF" fill="#FFFFFF" />
            </Animated.View>
          </Pressable>

          {/* Author overlay — avatar + name on the content, top-left */}
          <View style={[igCardStyles.authorOverlay, { top: 10 + topOffset }]} pointerEvents="box-none">
            <TouchableOpacity style={igCardStyles.authorOverlayLeft} onPress={handleProfileTap}>
              <Avatar uri={authorAvatar} name={post.author.name} size={26} colors={colors} />
              <View style={{ flexShrink: 1 }}>
                <Text style={igCardStyles.overlayUsername} numberOfLines={1}>{post.author.name}</Text>
                <Text style={igCardStyles.overlayLocation} numberOfLines={1}>
                  {post.location ? `${post.location} · ` : ''}{timeAgo(post.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={igCardStyles.overlayMenuBtn} onPress={handleMenuPress} accessibilityLabel="Post options">
              <MoreHorizontal size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Right action rail */}
          <View style={igCardStyles.actionRail} pointerEvents="box-none">
            <TouchableOpacity style={igCardStyles.railBtn} onPress={handleLike} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
              <View style={igCardStyles.railIconWrap}>
                <Heart size={26} strokeWidth={2} color={liked ? '#FF3040' : '#FFFFFF'} fill={liked ? '#FF3040' : 'none'} />
              </View>
              <Text style={igCardStyles.railCount}>{likeCount > 0 ? formatCount(likeCount) : ' '}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={igCardStyles.railBtn} onPress={() => onComment(post)} accessibilityLabel="Comments">
              <View style={igCardStyles.railIconWrap}>
                <MessageCircle size={26} strokeWidth={2} color="#FFFFFF" />
              </View>
              <Text style={igCardStyles.railCount}>{commentCount > 0 ? formatCount(commentCount) : ' '}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={igCardStyles.railBtn} onPress={() => onShare(post)} accessibilityLabel="Share">
              <View style={igCardStyles.railIconWrap}>
                <Send size={24} strokeWidth={2} color="#FFFFFF" style={{ transform: [{ rotate: '15deg' }] }} />
              </View>
              <Text style={igCardStyles.railCount}> </Text>
            </TouchableOpacity>
            <TouchableOpacity style={igCardStyles.railBtn} onPress={handleSave} accessibilityLabel={saved ? 'Unsave' : 'Save'}>
              <View style={igCardStyles.railIconWrap}>
                <Bookmark size={25} strokeWidth={2} color="#FFFFFF" fill={saved ? '#FFFFFF' : 'none'} />
              </View>
            </TouchableOpacity>
            {isVideo ? (
              <TouchableOpacity style={[igCardStyles.railBtn, { marginTop: 8 }]} onPress={onToggleMute} accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
                <View style={igCardStyles.railIconWrap}>
                  {muted ? <VolumeX size={20} color="#FFFFFF" /> : <Volume2 size={20} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Bottom caption — tap to open the post + comments */}
          <TouchableOpacity activeOpacity={0.85} style={[igCardStyles.commentPreview, { bottom: height ? tabBarSpace : 0 }]} onPress={onPress}>
            {post.caption ? (
              <Text style={igCardStyles.commentPreviewCaption} numberOfLines={2}>
                <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{post.author.name}</Text>{'  '}
                {post.caption}
              </Text>
            ) : null}
            <Text style={igCardStyles.commentPreviewLinkText}>
              {commentCount > 0 ? `View all ${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add a comment…'}
            </Text>
          </TouchableOpacity>

          {/* Live voice layer — only the active post holds a connection */}
          {isActive ? (
            <PostLiveLayer
              postId={post.id}
              userId={currentUser?.id ?? ''}
              userName={currentUser?.fullName || currentUser?.username || 'You'}
              avatar={currentUser?.avatar || null}
              bottomOffset={height ? tabBarSpace : 0}
              topOffset={topOffset}
            />
          ) : null}
        </View>
      ) : (
        <View style={[igCardStyles.header, { paddingTop: 10 + topOffset }]}>
          <TouchableOpacity style={igCardStyles.headerLeft} onPress={handleProfileTap}>
            <Avatar uri={authorAvatar} name={post.author.name} size={36} colors={colors} />
            <View style={igCardStyles.headerText}>
              <Text style={[igCardStyles.username, { color: colors.text }]}>{post.author.name}</Text>
              <Text style={[igCardStyles.location, { color: colors.textTertiary }]}>
                {post.location ? `${post.location} · ` : ''}{timeAgo(post.timestamp)}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={igCardStyles.menuBtn} onPress={handleMenuPress} accessibilityLabel="Post options">
            <MoreHorizontal size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Text-only post */}
      {!post.media ? (
        <>
          <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[igCardStyles.textOnlyArea, height ? { flex: 1 } : undefined]}>
            <Text style={[igCardStyles.textOnlyCaption, { color: colors.text }]} numberOfLines={height ? 18 : 6}>
              {post.caption}
            </Text>
          </TouchableOpacity>

          <View style={igCardStyles.actionBar}>
            <View style={igCardStyles.actionLeft}>
              <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={handleLike} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
                <Heart size={26} color={liked ? '#FF3040' : colors.text} fill={liked ? '#FF3040' : 'none'} />
              </TouchableOpacity>
              <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={() => onComment(post)} accessibilityLabel="Comments">
                <MessageCircle size={26} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={() => onShare(post)} accessibilityLabel="Share">
                <Send size={24} color={colors.text} style={{ transform: [{ rotate: '15deg' }] }} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={handleSave} accessibilityLabel={saved ? 'Unsave' : 'Save'}>
              <Bookmark size={26} color={colors.text} fill={saved ? colors.text : 'none'} />
            </TouchableOpacity>
          </View>

          <View style={igCardStyles.likesRow}>
            <Text style={[igCardStyles.likesText, { color: colors.text }]}>
              {liked ? (
                <>Liked by <Text style={{ fontWeight: '700' }}>you</Text>{likeCount > 1 ? <> and{' '}<Text style={{ fontWeight: '700' }}>{likeCount - 1} {likeCount - 1 === 1 ? 'other' : 'others'}</Text></> : null}</>
              ) : (
                <><Text style={{ fontWeight: '700' }}>{likeCount}</Text> {likeCount === 1 ? 'like' : 'likes'}</>
              )}
            </Text>
          </View>

          <TouchableOpacity style={igCardStyles.commentsLink} onPress={() => onComment(post)}>
            <Text style={[igCardStyles.commentsLinkText, { color: colors.textTertiary }]}>
              {commentCount > 0 ? `View all ${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add a comment…'}
            </Text>
          </TouchableOpacity>
          <View style={{ height: 14 }} />
        </>
      ) : null}
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// ═══════════════════════════════════════════════════════════════════════════
// Create Post Modal
// ═══════════════════════════════════════════════════════════════════════════
// Main Feed Screen
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const floatBarSpace = insets.top + FLOAT_BAR_HEIGHT;
  // Light status-bar icons while the feed is showing (they sit on the dark
  // top fade); restore the theme's style when leaving the tab.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(isDark ? 'light' : 'dark');
    }, [isDark]),
  );
  const { handleScroll: handleTabBarScroll, hideTabBar, showTabBar } = useTabBar();
  const { user: authUser } = useAuth();
  const userAvatar = authUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';
  const { addUserPost } = useUserPosts();
  const { deletePost, createPost, feedStories, userStories, getAllPosts, hidePost, refreshPosts, isFeedLoading } = useSocial();
  // Videos start muted (like Reels); one tap toggles sound for the whole feed.
  const [muted, setMuted] = useState(true);
  // "Posting…" banner while media uploads and the post saves.
  const [posting, setPosting] = useState<{ thumb?: string; failed?: boolean; retry?: () => void } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createPreloadMedia, setCreatePreloadMedia] = useState<string | null>(null);
  const [createPreloadMediaWidth, setCreatePreloadMediaWidth] = useState<number | undefined>(undefined);
  const [createPreloadMediaHeight, setCreatePreloadMediaHeight] = useState<number | undefined>(undefined);
  const [createMediaType, setCreateMediaType] = useState<'photo' | 'video'>('photo');
  const [showCamera, setShowCamera] = useState(false);
  const [createCategory, setCreateCategory] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // ── Stories UI state ──
  const [showStoriesViewer, setShowStoriesViewer] = useState(false);
  const [storyViewerStartIndex, setStoryViewerStartIndex] = useState(0);
  const [showCreateStory, setShowCreateStory] = useState(false);
  // ── Full-screen snap paging: measured viewport height for each 'page' ──
  const [feedHeight, setFeedHeight] = useState(0);
  // Header height (state mirror of headerHeight ref) — used to size pages to the visible area
  const [headerHeightState, setHeaderHeightState] = useState(0);

  // Header is now in normal flow (pinned, not absolute), so the flex:1 wrapper below it
  // already measures exactly the visible content area between the header and the tab bar.
  const contentHeight = feedHeight > 0 ? feedHeight : 0;

  // ── Live Voice Feed: active-post detection (TikTok-style snap paging) ──
  // Each post is exactly one page tall, so the active post is simply
  // round(scrollY / pageHeight). (FlatList viewability callbacks proved
  // unreliable with full-screen paging — they stopped firing entirely.)
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);
  const trackActive = useCallback((y: number, pageHeight: number) => {
    if (pageHeight <= 0) return;
    const idx = Math.max(0, Math.round(y / pageHeight));
    if (idx === activeIndexRef.current) return;
    activeIndexRef.current = idx;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // Short settle so fast flicks don't spin up a video/voice room per post.
    settleTimer.current = setTimeout(() => setActiveIndex(idx), 200);
  }, []);

  // ── Scroll-away header: hides on scroll up, reappears on scroll down ──
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(0);
  const headerVisible = useRef(true);
  const lastHeaderScrollY = useRef(0);

  const showHeader = useCallback(() => {
    if (!headerVisible.current) {
      headerVisible.current = true;
      Animated.spring(headerTranslateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start();
    }
  }, [headerTranslateY]);

  const hideHeader = useCallback(() => {
    if (headerVisible.current && headerHeight.current > 0) {
      headerVisible.current = false;
      Animated.spring(headerTranslateY, { toValue: -headerHeight.current, useNativeDriver: true, tension: 100, friction: 12 }).start();
    }
  }, [headerTranslateY]);

  const handleHeaderScroll = useCallback((currentY: number) => {
    const diff = currentY - lastHeaderScrollY.current;
    if (currentY <= 0) showHeader();
    else if (diff > 10) hideHeader();
    else if (diff < -5) showHeader();
    lastHeaderScrollY.current = currentY;
  }, [showHeader, hideHeader]);

  // Load saved post IDs from Supabase
  useEffect(() => {
    if (!authUser?.id) return;
    supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).then(({ data, error }) => {
      if (!error && data) setSavedIds(new Set((data as any[]).map(r => r.post_id)));
    });
  }, [authUser?.id]);

  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<FeedPost>>(null);
  const [userPosts, setUserPosts] = useState<FeedPost[]>([]);
  // ── Mentions strip: posts where someone I follow @-mentioned me ──
  const [mentionThumbs, setMentionThumbs] = useState<{ id: string; mediaUrl: string; isVideo: boolean; postId: string }[]>([]);

  // ── Network filter: feed shows only people you follow + people who follow you + yourself ──
  const [networkIds, setNetworkIds] = useState<Set<string> | null>(null);
  const loadNetwork = useCallback(async () => {
    const myId = authUser?.id;
    if (!myId) { setNetworkIds(null); return; }
    try {
      const [{ data: following }, { data: followers }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', myId),
        supabase.from('follows').select('follower_id').eq('following_id', myId),
      ]);
      const ids = new Set<string>([myId]);
      (following || []).forEach((f: any) => { if (f?.following_id) ids.add(f.following_id); });
      (followers || []).forEach((f: any) => { if (f?.follower_id) ids.add(f.follower_id); });
      setNetworkIds(ids);
    } catch (_) {
      // Fail closed: if the network query fails, only show the user's own posts.
      setNetworkIds(new Set<string>([myId]));
    }
  }, [authUser?.id]);

  useEffect(() => { loadNetwork(); }, [loadNetwork]);

  // ── Mentions: fetch notifications where someone I follow @-mentioned me, resolve media ──
  const loadMentions = useCallback(async () => {
    const myId = authUser?.id;
    if (!myId) { setMentionThumbs([]); return; }
    try {
      const [{ data: following }, { data: mentions }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', myId),
        supabase.from('notifications').select('id, actor_id, data').eq('user_id', myId).eq('type', 'mention').order('created_at', { ascending: false }).limit(50),
      ]);
      const followingIds = new Set((following || []).map((f: any) => f.following_id).filter(Boolean));
      if (followingIds.size === 0) { setMentionThumbs([]); return; }
      const myMentions = (mentions || []).filter((n: any) => followingIds.has(n?.actor_id) && n?.data?.content_id);
      if (myMentions.length === 0) { setMentionThumbs([]); return; }
      const contentIds = [...new Set(myMentions.map((n: any) => n.data.content_id))];
      const { data: posts } = await supabase.from('posts').select('*').in('id', contentIds);
      const postMap = new Map((posts || []).map((p: any) => [p.id, p]));
      const thumbs: { id: string; mediaUrl: string; isVideo: boolean; postId: string }[] = [];
      for (const m of myMentions) {
        const p = postMap.get(m.data.content_id);
        if (!p) continue;
        const videoUrl = (p as any).video_url || (p as any).videoUrl;
        const imageUrl = (p as any).image_url || (p as any).imageUrl;
        const mediaUrl = videoUrl || imageUrl;
        if (!mediaUrl) continue; // media-only
        const isVideo = ((p as any).media_type === 'video') || !!videoUrl;
        thumbs.push({ id: m.id, mediaUrl, isVideo, postId: p.id });
      }
      setMentionThumbs(thumbs);
    } catch (_) {
      setMentionThumbs([]);
    }
  }, [authUser?.id]);

  useEffect(() => { loadMentions(); }, [loadMentions]);

  // Load feed posts: show ONLY network posts (people you follow + people who follow you + yourself), newest first
  const lastPostCountRef = useRef('');
  const loadFeedPosts = useCallback(() => {
    const posts = getAllPosts() || [];
    const allPosts: FeedPost[] = posts
      .filter((p: any) => {
        const authorId = p.user?.id || p.user_id;
        if (!authorId) return false;
        // Always show the user's own posts.
        if (authUser?.id && authorId === authUser?.id) return true;
        // Until the network resolves, don't leak others' posts (fail closed).
        if (!networkIds) return false;
        return networkIds.has(authorId);
      })
      .map((p: any) => ({
        id: p.id,
        type: ((p.mediaType === 'video' || p.videoUrl || p.video_url) ? 'video' : (p.imageUrl || p.image_url) ? 'photo' : 'text') as PostType,
        author: { name: p.user?.name || p.author_name || 'Unknown', avatar: p.user?.avatar || '', userId: p.user?.id || p.user_id },
        category: p.category || 'General',
        // createdAt is the real ISO time; `timestamp` may already be "2h".
        timestamp: p.createdAt || p.created_at || p.timestamp || '',
        caption: p.content || p.caption || '',
        media: p.imageUrl || p.image_url || p.mediaUri || p.videoUrl || p.video_url || '',
        videoUrl: p.videoUrl || p.video_url,
        likes: p.likes || 0,
        tags: p.tags || [],
        stats: { saves: p.shares || 0, comments: p.comments || 0 },
      }))
      .sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));
    // Only update if the posts (or their counts) actually changed
    const key = allPosts.map(p => `${p.id}:${p.likes}:${p.stats.comments}`).join(',');
    if (key === lastPostCountRef.current) return;
    lastPostCountRef.current = key;
    setUserPosts(allPosts);
  }, [getAllPosts, networkIds, authUser?.id]);

  // Run the loader whenever the posts provider signals new data (mount/refresh)
  useEffect(() => {
    loadFeedPosts();
  }, [loadFeedPosts]);

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [viewerMedia, setViewerMedia] = useState<string | null>(null);
  const [viewerMediaIsVideo, setViewerMediaIsVideo] = useState(false);
  // Skeletons only while the very first load is still running.
  const isInitialLoad = isFeedLoading && userPosts.length === 0;

  // ── Transform stories into StoryUser[] format for StoriesViewer ──
  const storyUsers = useMemo((): StoryUser[] => {
    // Combine user stories and feed stories, group by user
    const userMap = new Map<string, { name: string; avatar: string; stories: StoryMedia[] }>();

    const addStory = (
      id: string,
      userId: string,
      name: string,
      avatar: string,
      imageUrl: string,
      timestamp: string,
    ) => {
      if (!userMap.has(userId)) {
        userMap.set(userId, { name, avatar, stories: [] });
      }
      const entry = userMap.get(userId)!;
      // Avoid duplicates
      if (!entry.stories.find(s => s.id === id)) {
        entry.stories.push({
          id,
          mediaUrl: imageUrl,
          createdAt: timestamp,
        });
      }
    };

    // Add user's own stories first (so they appear first)
    userStories.forEach(s => {
      addStory(s.id, s.user.id, s.user.name, s.user.avatar, s.imageUrl, s.timestamp);
    });

    // Add feed stories (network only)
    feedStories.forEach(s => {
      const authorId = s.user?.id;
      if (authorId && networkIds && !networkIds.has(authorId)) return;
      addStory(s.id, s.user.id, s.user.name, s.user.avatar, s.imageUrl, s.timestamp);
    });

    return Array.from(userMap.entries()).map(([userId, data]) => ({
      userId,
      name: data.name,
      avatar: data.avatar,
      stories: data.stories.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }));
  }, [userStories, feedStories, networkIds]);

  const myStoryIndex = useMemo(() => storyUsers.findIndex((u) => u.userId === authUser?.id), [storyUsers, authUser?.id]);

  const toggleMute = useCallback(() => {
    Haptics.selectionAsync();
    setMuted((m) => !m);
  }, []);

  const filteredPosts = useMemo<FeedPost[]>(() => {
    // ── Deduplication: prefer context data over hardcoded ──
    const seenIds = new Set<string>();
    const seenContentKeys = new Set<string>();
    const deduped: FeedPost[] = [];

    const isDuplicate = (post: FeedPost): boolean => {
      if (seenIds.has(post.id)) return true;
      // Near-duplicate detection: only for posts with actual text content
      const caption = (post.caption || '').toLowerCase().trim();
      if (caption) {
        const contentKey = `${caption}|${post.author.name.toLowerCase().trim()}`;
        if (seenContentKeys.has(contentKey)) return true;
      }
      return false;
    };

    const addPost = (post: FeedPost) => {
      if (isDuplicate(post)) return;
      seenIds.add(post.id);
      const caption = (post.caption || '').toLowerCase().trim();
      if (caption) {
        seenContentKeys.add(`${caption}|${post.author.name.toLowerCase().trim()}`);
      }
      deduped.push(post);
    };

    // Only social posts in feed — no commercial/listing content
    userPosts.forEach(addPost);

    let all = deduped;
    if (tagFilter) all = all.filter((p) => p.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase())));
    // Keep newest-first order (posts are pre-sorted in loadFeedPosts)
    return all;
  }, [userPosts, tagFilter]);

  const activePostId = filteredPosts[Math.min(activeIndex, Math.max(0, filteredPosts.length - 1))]?.id ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTagFilter(null);
    try {
      // The feed reads from refreshPosts (posts + live like/comment counts).
      // Before, pull-to-refresh only invalidated an unused query, so new
      // posts never appeared until the app restarted.
      await Promise.all([
        refreshPosts(),
        loadNetwork(),
        loadMentions(),
        queryClient.invalidateQueries({ queryKey: ['supabaseStories'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, loadMentions, loadNetwork, refreshPosts]);

  const handleSavePost = useCallback((postId: string) => {
    if (!authUser?.id) return;
    const wasSaved = savedIds.has(postId);
    const flip = (save: boolean) => setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(postId); else next.delete(postId);
      return next;
    });
    flip(!wasSaved);
    const request = wasSaved
      ? supabase.from('saved_posts').delete().eq('user_id', authUser.id).eq('post_id', postId)
      : supabase.from('saved_posts').upsert({ user_id: authUser.id, post_id: postId }, { onConflict: 'user_id,post_id' });
    request.then(({ error }) => {
      if (error) {
        flip(wasSaved); // put it back so the icon matches the server
        Alert.alert(wasSaved ? 'Could not unsave' : 'Could not save', 'Check your connection and try again.');
      }
    });
  }, [authUser?.id, savedIds]);

  const handleSharePost = async (post: FeedPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const link = post.videoUrl || post.media;
    const text = [`${post.author.name} on Apparently`, post.caption, link].filter(Boolean).join('\n\n');
    try {
      await Share.share(Platform.OS === 'ios' && link ? { message: [`${post.author.name} on Apparently`, post.caption].filter(Boolean).join('\n\n'), url: link } : { message: text });
    } catch (err) {
      // user cancelled share — ignore
    }
  };

  const handleDeletePost = (postId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deletePost(postId);
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleReportPost = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!authUser?.id) return;
    supabase.from('reports').insert({ post_id: postId, reported_by: authUser.id, reason: 'Reported post' }).then(({ error }) => {
      if (error) { Alert.alert('Report failed', error.message); }
      else { Alert.alert('Reported', 'Thanks — we will review this post.'); }
    });
  };

  const handleHidePost = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Persisted per account; SocialContext filters hidden posts out of the feed.
    hidePost(postId);
    // Remove from the local feed immediately so it disappears for this user.
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // expo-av was removed in Expo SDK 58 — video now plays through expo-video.
  const VideoPlayer = AppVideo;

  const handleCreatePost = (data: { caption: string; mediaUri?: string; mediaWidth?: number; mediaHeight?: number; category?: string }) => {
    const isVideoPost = !!data.mediaUri && createMediaType === 'video';
    const run = async () => {
      setPosting({ thumb: isVideoPost ? undefined : data.mediaUri });
      const id = await createPost(data.caption, data.mediaUri, {
        mediaType: data.mediaUri ? (isVideoPost ? 'video' : 'image') : undefined,
      });
      if (id) {
        setPosting(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Keep the profile grid in sync
        addUserPost({ id, caption: data.caption, mediaUri: data.mediaUri, timestamp: new Date().toISOString() });
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPosting({ thumb: isVideoPost ? undefined : data.mediaUri, failed: true, retry: run });
      }
    };
    run();

    // Close the composer right away; the banner shows progress.
    setShowCreate(false);
    setCreatePreloadMedia(null);
    setCreateCategory(null);
  };

  // ── Camera flow (Instagram-style viewfinder) ──
  const handleCreateTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Create Post', '', [
      { text: 'Take Photo/Video', onPress: () => {
        hideTabBar();
        setShowCamera(true);
      }},
      { text: 'Write Text Post', onPress: () => {
        setCreateMediaType('photo');
        setCreatePreloadMedia(null);
        setCreatePreloadMediaWidth(undefined);
        setCreatePreloadMediaHeight(undefined);
        setShowCreate(true);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Called when user captures from InstagramCamera
  const handleCameraCapture = (media: CapturedMedia) => {
    // The camera captures photos; reset in case a video was picked earlier.
    setCreateMediaType('photo');
    setCreatePreloadMedia(media.uri);
    setCreatePreloadMediaWidth(media.width);
    setCreatePreloadMediaHeight(media.height);
    setShowCamera(false);
    showTabBar();
    setShowCreate(true);
  };

  // Called when user taps gallery from within InstagramCamera
  const handlePickFromGallery = async () => {
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libPerm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: false,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video' && asset.duration && asset.duration > 60000) {
        Alert.alert('Video too long', 'Please select a video under 60 seconds.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 100 * 1024 * 1024) {
        Alert.alert('File too large', 'Please pick something under 100 MB.');
        return;
      }
      setCreatePreloadMedia(asset.uri);
      setCreatePreloadMediaWidth(asset.width);
      setCreatePreloadMediaHeight(asset.height);
      setCreateMediaType(asset.type === 'video' ? 'video' : 'photo');
      setShowCamera(false);
      showTabBar();
      setShowCreate(true);
    }
  };

  // Called when camera is dismissed without capturing
  const handleCameraClose = () => {
    setShowCamera(false);
    showTabBar();
  };

  const handleComment = (post: FeedPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPost(post);
  };

  const handleTagTap = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTagFilter((prev) => (prev === tag ? null : tag));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating top bar — stories + actions hover over the feed, so posts
          get the whole screen (the old logo header + story row took ~25%). */}
      <View style={[styles.floatBar, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.floatRow} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'center', paddingLeft: 9, paddingRight: 6 }}
          >
            <StoryRing
              avatar={userAvatar}
              name="Your story"
              size={STORY_SIZE}
              showName={false}
              hasUnviewed={myStoryIndex >= 0}
              isAddStory={myStoryIndex < 0}
              onPress={() => {
                if (myStoryIndex >= 0) {
                  setStoryViewerStartIndex(myStoryIndex);
                  setShowStoriesViewer(true);
                } else {
                  setShowCreateStory(true);
                }
              }}
            />
            {storyUsers.map((storyUser, idx) => (
              storyUser.userId === authUser?.id ? null : (
                <StoryRing
                  key={storyUser.userId}
                  avatar={storyUser.avatar}
                  name={storyUser.name}
                  size={STORY_SIZE}
                  showName={false}
                  hasUnviewed
                  onPress={() => {
                    setStoryViewerStartIndex(idx);
                    setShowStoriesViewer(true);
                  }}
                />
              )
            ))}
            {/* Mentions from people you follow — small tiles after the stories */}
            {mentionThumbs.length > 0 ? <View style={styles.floatDivider} /> : null}
            {mentionThumbs.map((t) => (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.85}
                onPress={() => { setViewerMedia(t.mediaUrl); setViewerMediaIsVideo(t.isVideo); }}
                style={styles.mentionTile}
                accessibilityLabel="Post you were mentioned in"
              >
                {t.isVideo ? (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
                    <Play size={14} color="#FFF" fill="#FFF" />
                  </View>
                ) : (
                  <RNImage source={{ uri: t.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                )}
                <View style={styles.mentionBadge}><Text style={styles.mentionBadgeText}>@</Text></View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.floatIcons}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/search' as any)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityLabel="Search"
            >
              <Search size={23} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
            <HeaderActivityButtons size={23} color="#FFFFFF" gap={18} />
          </View>
        </View>

        {tagFilter ? (
          <View style={[styles.tagFilterPill, { backgroundColor: 'rgba(0,0,0,0.55)', marginLeft: 12, marginTop: 6 }]}>
            <Text style={[styles.tagFilterText, { color: '#FFF' }]}>#{tagFilter}</Text>
            <TouchableOpacity onPress={() => setTagFilter(null)} accessibilityLabel="Clear filter">
              <X size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Posting progress ── */}
        {posting ? (
          <View style={[styles.postingBar, { backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 6 }]}>
            {posting.thumb ? <RNImage source={{ uri: posting.thumb }} style={styles.postingThumb} /> : <View style={[styles.postingThumb, { backgroundColor: colors.border }]} />}
            <Text style={{ flex: 1, color: posting.failed ? '#EF4444' : colors.text, fontWeight: '600', fontSize: 14 }}>
              {posting.failed ? "Couldn't post — check your connection" : 'Posting…'}
            </Text>
            {posting.failed ? (
              <>
                <TouchableOpacity onPress={() => posting.retry?.()} style={{ paddingHorizontal: 8 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPosting(null)} accessibilityLabel="Dismiss">
                  <X size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="small" color={colors.accent} />
            )}
          </View>
        ) : null}
      </View>

      {isInitialLoad ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: floatBarSpace + 8, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          <SkeletonCard count={5} shimmerColor={colors.accent + '30'} baseColor={colors.surface} />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }} onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0 && Math.abs(h - feedHeight) > 1) setFeedHeight(h); }}>
        {/* Mount the list only once the page height is known, so every post
            is one exact page from the first frame (mixing measured and fixed
            heights left the list unable to render posts further down). */}
        {contentHeight > 0 ? (
        <FlatList
          ref={listRef}
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              colors={colors}
              height={contentHeight || undefined}
              isActive={item.id === activePostId}
              muted={muted}
              onToggleMute={toggleMute}
              topOffset={floatBarSpace}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedPost(item);
              }}
              onSave={handleSavePost}
              onComment={handleComment}
              onShare={handleSharePost}
              onTagTap={handleTagTap}
              onMediaTap={(uri, isVideo) => { setViewerMediaIsVideo(!!isVideo); setViewerMedia(uri); }}
              onDelete={handleDeletePost}
              onReport={handleReportPost}
              onHide={handleHidePost}
              isSaved={savedIds.has(item.id)}
            />
          )}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 0 }}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            handleTabBarScroll(y);
            trackActive(y, contentHeight);
          }}
          onMomentumScrollEnd={(e) => trackActive(e.nativeEvent.contentOffset.y, contentHeight)}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} progressViewOffset={floatBarSpace} />}
          decelerationRate="fast"
          snapToInterval={contentHeight || undefined}
          snapToAlignment="start"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({ length: contentHeight, offset: contentHeight * index, index })}
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          removeClippedSubviews={Platform.OS === 'android'}

          ListEmptyComponent={() => (
            <View style={[styles.emptyState, contentHeight ? { height: contentHeight, paddingTop: floatBarSpace } : null]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '18' }]}>
                {tagFilter ? <FileText size={34} color={colors.accent} /> : <Users size={34} color={colors.accent} />}
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {tagFilter ? 'No matching posts' : 'Your feed is quiet'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                {tagFilter
                  ? `No posts tagged #${tagFilter}.`
                  : 'Posts from people you follow, people who follow you, and you show up here.'}
              </Text>
              {!tagFilter ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/(tabs)/search' as any)}>
                    <Search size={16} color="#FFF" />
                    <Text style={styles.emptyBtnText}>Find people</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={handleCreateTap}>
                    <Camera size={16} color={colors.text} />
                    <Text style={[styles.emptyBtnText, { color: colors.text }]}>Create post</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        />
        ) : null}
        </View>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          visible={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          colors={colors}
          onSave={handleSavePost}
          isSaved={savedIds.has(selectedPost.id)}
          onPlayVideo={(uri) => { setViewerMediaIsVideo(false); setViewerMedia(uri); }}
          onOpenProfile={(userId) => {
            if (!userId) return;
            setSelectedPost(null);
            router.push((userId === authUser?.id ? '/(tabs)/profile' : `/user/${userId}`) as any);
          }}
        />
      )}

      {/* Instagram Camera — full-screen custom viewfinder (Modal overlays tab bar) */}
      <Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
        <InstagramCamera
          visible={showCamera}
          onClose={handleCameraClose}
          onCapture={handleCameraCapture}
          onPickFromGallery={handlePickFromGallery}
        />
      </Modal>

      {/* Post Composer — Instagram-style single screen */}
      <PostComposer
        visible={showCreate}
        onClose={() => { setShowCreate(false); setCreatePreloadMedia(null); }}
        onPost={handleCreatePost}
        preloadMediaUri={createPreloadMedia}
        preloadMediaWidth={createPreloadMediaWidth}
        preloadMediaHeight={createPreloadMediaHeight}
        backgroundColor={colors.background}
        textColor={colors.text}
        accentColor={colors.accent}
      />

      {/* ── Stories Viewer ── */}
      <StoriesViewer
        visible={showStoriesViewer}
        onClose={() => setShowStoriesViewer(false)}
        allStoryUsers={storyUsers}
        initialUserIndex={storyViewerStartIndex}
      />

      {/* ── Create Story ── */}
      <CreateStory
        visible={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onStoryCreated={() => setShowCreateStory(false)}
        colors={{
          background: colors.background,
          text: colors.text,
          accent: colors.accent,
          surface: colors.surface,
        }}
      />

      {/* Media Viewer Modal — full‑screen like Instagram */}
      <Modal visible={!!viewerMedia} animationType="fade" statusBarTranslucent>
        <TouchableOpacity
          style={[styles.viewerContainer, { backgroundColor: '#000' }]}
          activeOpacity={1}
          onPress={() => setViewerMedia(null)}
        >
          <TouchableOpacity style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerMedia(null)}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          {viewerMedia && viewerMediaIsVideo && VideoPlayer ? (
            <VideoPlayer
              source={{ uri: viewerMedia }}
              style={styles.viewerImage}
              resizeMode="contain"
              shouldPlay
              isLooping
              useNativeControls
            />
          ) : viewerMedia ? (
            <RNImage source={{ uri: viewerMedia }} style={styles.viewerImage} resizeMode="cover" />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, elevation: 30, paddingBottom: 14 },
  floatRow: { height: FLOAT_BAR_HEIGHT - 4, flexDirection: 'row', alignItems: 'center' },
  floatIcons: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingLeft: 10, paddingRight: 16 },
  floatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 6 },
  mentionTile: { width: 36, height: 36, borderRadius: 9, overflow: 'hidden', marginHorizontal: 3, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: '#222' },
  mentionBadge: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  mentionBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', marginTop: -1 },
  // Header
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.5 },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
    lineHeight: 12,
  },
  // Card
  card: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 14, fontWeight: '700' },
  metaSub: { fontSize: 12, marginTop: 1.5 },
  // Caption
  caption: { fontSize: 14, lineHeight: 21 },
  // Media
  mediaWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mediaImg: { width: '100%', borderRadius: 12 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  // Tags
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  tagText: { fontSize: 11, fontWeight: '500' },
  // Actions
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '600' },
  // List
  listContent: { paddingBottom: 100 },
  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  postingBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 8 },
  postingThumb: { width: 36, height: 36, borderRadius: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  // ── Modal Styles ──
  modalContainer: { flex: 1 },
  modalHeader: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  modalBackBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  modalContent: { paddingHorizontal: 16 },
  modalAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  modalAvatar: { width: 44, height: 44, borderRadius: 14 },
  modalMedia: { width: '100%', borderRadius: 12, marginTop: 12 },
  detailActions: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, marginTop: 16,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  detailActionBtn: { padding: 4 },
  commentsHeader: { fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  detailCount: { fontSize: 14, fontWeight: '700' },
  // Comments in modal
  commentItem: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  commentAvatar: { width: 32, height: 32, borderRadius: 10, marginTop: 2 },
  commentBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  commentName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentTime: { fontSize: 11, marginTop: 3, marginLeft: 4 },
  // Comment input
  commentInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1,
  },
  commentInputAvatar: { width: 32, height: 32, borderRadius: 10 },
  commentInputField: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // ── Create Post Modal ──
  createModal: { flex: 1 },
  createHeader: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createBackBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  createTitle: { fontSize: 17, fontWeight: '700' },
  createPostBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  createBody: { flex: 1 },
  createLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  typePicker: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  typeOptionText: { fontSize: 14, fontWeight: '600' },
  catPicker: { flexDirection: 'row', gap: 8 },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catOptionText: { fontSize: 13, fontWeight: '600' },
  createCaptionInput: { borderRadius: 12, borderWidth: 1, padding: 14, minHeight: 100, fontSize: 15, lineHeight: 22 },
  mediaPickerBtn: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 8 },
  mediaPickerText: { fontSize: 13, fontWeight: '600' },
  mediaPreview: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mediaPreviewImg: { width: '100%', height: 240, borderRadius: 12 },
  mediaRemoveBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  mediaActions: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', gap: 8 },
  mediaActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  tagField: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  tagAddBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tagRemovable: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  tagRemovableText: { fontSize: 12, fontWeight: '600' },
  // ── Tag Filter ──
  tagFilterBar: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  tagFilterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  tagFilterText: { fontSize: 13, fontWeight: '700' },
  // ── Media Viewer ──
  viewerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
});

// ── Instagram-Style Post Card Styles ──
const igCardStyles = StyleSheet.create({
  card: { marginBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(120,120,120,0.2)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  headerText: { gap: 1 },
  username: { fontSize: 13, fontWeight: '700' },
  typeLabel: { fontSize: 12, fontWeight: '500' },
  location: { fontSize: 11 },
  menuBtn: { padding: 4 },
  menuDots: { fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  media: { width: SCREEN_WIDTH, backgroundColor: '#0a0a0a' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  authorOverlay: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 10 },
  authorOverlayLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 22, maxWidth: '82%' },
  overlayAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)' },
  overlayUsername: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  overlayTypeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500' },
  overlayLocation: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 1 },
  overlayMenuBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  overlayMenuDots: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  textOnlyArea: { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  textOnlyCaption: { fontSize: 16, lineHeight: 24 },
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIconBtn: { padding: 4 },
  likesRow: { paddingHorizontal: 12, paddingBottom: 4 },
  likesText: { fontSize: 13, lineHeight: 18 },
  captionRow: { paddingHorizontal: 12, paddingBottom: 4 },
  captionText: { fontSize: 13, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  hashTag: { fontSize: 13, fontWeight: '600' },
  commentsLink: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 2 },
  commentsLinkText: { fontSize: 13 },
  timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 14 },
  timestamp: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  ctaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  ctaPillText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  actionRail: { position: 'absolute', right: 8, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2, zIndex: 11 },
  railBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 0 },
  railIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.30)', alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  railCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  commentPreview: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingLeft: 14, paddingRight: 64, paddingBottom: 10, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 10 },
  commentPreviewCaption: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.92)', marginBottom: 6, paddingRight: 12 },
  commentPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 },
  commentPreviewLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  commentPreviewLinkText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  commentPreviewTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});
