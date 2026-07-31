import {
  Calendar, Clock, MapPin, Users, Sparkles, Dumbbell, Utensils, Palette,
  Plane, Heart, Music, Zap, Play, Plus, Eye,
  MessageCircle, CheckCircle2, Wrench, Bookmark,
  Radio, Image as ImageIcon, Video as VideoIcon, FileText, X, Send, ChevronLeft, Camera,
  ShoppingBag, Home, Repeat, UserPlus, Search, Package,
  Star, MessagesSquare, Forward
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
} from 'react-native';
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
import { EXTERNAL_EVENTS } from '@/lib/externalEvents';
import SkeletonCard from '@/components/SkeletonCard';
import PostComposer, { POST_CATEGORIES as POST_CATS } from '@/components/PostComposer';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Reels-style 9:16 portrait container (1080×1920 proportions)
const FEED_ASPECT = 9 / 16; // width:height
const FEED_MEDIA_HEIGHT = Math.round(SCREEN_WIDTH / FEED_ASPECT);

// ── Types ──────────────────────────────────────────────────────────────────

type PostType = 'text' | 'photo' | 'video' | 'live' | 'event' | 'plan' | 'achievement' | 'marketplace' | 'rental' | 'swap' | 'connection' | 'request' | 'bundle';

interface Comment {
  id: string;
  user: { name: string; avatar: string; userId?: string };
  text: string;
  timestamp: string;
}

interface FeedPost {
  id: string;
  type: PostType;
  title?: string;
  author: { name: string; avatar: string; userId?: string };
  category: string;
  timestamp: string;
  caption: string;
  media?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  location?: string;
  date?: string;
  attendees?: number;
  maxAttendees?: number;
  tags: string[];
  likes: number;
  stats: { saves: number; comments: number };
  viewerCount?: number;
  streamDuration?: string;
  videoUrl?: string;
  authorId?: string;
  comments_list?: Comment[];
  price?: number | string;
  pricePerNight?: string;
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

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// All mock data removed — feed is live-only from Supabase + user posts
const MOCK_COMMENTS: Comment[] = [];

const FILTERS = [
  { key: 'all', label: 'All', icon: FileText },
  { key: 'live', label: 'Live', icon: Radio },
  { key: 'photo', label: 'Photos', icon: ImageIcon },
  { key: 'video', label: 'Videos', icon: VideoIcon },
  { key: 'event', label: 'Events', icon: Sparkles },
  { key: 'plan', label: 'Plans', icon: Calendar },
];

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

function PostDetailModal({
  post,
  visible,
  onClose,
  colors,
  onSave,
  onJoin,
  onWatch,
  onCelebrate,
}: {
  post: FeedPost;
  visible: boolean;
  onClose: () => void;
  colors: any;
  onSave: (postId: string) => void;
  onJoin: (postId: string) => void;
  onWatch: (postId: string) => void;
  onCelebrate: (postId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [commentText, setCommentText] = useState('');
  const { interactions, toggleLike } = useSocial();
  const interaction = interactions[post.id];
  const liked = interaction?.isLiked ?? false;
  const [kbHeight, setKbHeight] = useState(0);
  const [localComments, setLocalComments] = useState<Comment[]>([]);

  // Sync local comments with SocialContext interactions on mount and when interaction changes
  useEffect(() => {
    const synced: Comment[] = (interaction?.comments || []).map((c: any) => ({
      id: c.id,
      user: { name: c.userName || c.user?.name || 'User', avatar: c.userAvatar || c.user?.avatar || '', userId: c.userId },
      text: c.text,
      timestamp: c.timestamp || c.createdAt || '',
    }));
    if (synced.length > 0) {
      setLocalComments(synced);
    } else if (post.comments_list && post.comments_list.length > 0) {
      // Fallback to post-level comments if no interactions exist
      setLocalComments(post.comments_list);
    }
  }, [interaction, post.comments_list]);
  const cat = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG.Creative;
  const CatIcon = cat.icon;
  const authorAvatar = post.author.avatar || '';

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const { user: currentUser } = useAuth();
  const commentAvatar = currentUser?.avatar || '';

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newComment: Comment = {
      id: `c-new-${Date.now()}`,
      user: { name: 'You', avatar: commentAvatar, userId: currentUser?.id },
      text: trimmed,
      timestamp: 'Just now',
    };
    setLocalComments((prev) => [newComment, ...prev]);
    setCommentText('');
  };

  const badge = (() => {
    switch (post.type) {
      case 'live': return { label: 'LIVE', bg: '#EF444415', fg: '#EF4444' };
      case 'event': return { label: 'Event', bg: '#8B5CF615', fg: '#8B5CF6' };
      case 'plan': return { label: 'Plan', bg: '#3B82F615', fg: '#3B82F6' };
      case 'achievement': return { label: 'Milestone', bg: '#10B98115', fg: '#10B981' };
      case 'bundle': return { label: 'Bundle', bg: '#8B5CF615', fg: '#8B5CF6' };
      default: return null;
    }
  })();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Modal Header */}
        <View style={[styles.modalHeader, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalBackBtn}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Post</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={localComments}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(100, kbHeight + 60) }}
          ListHeaderComponent={() => (
            <View style={styles.modalContent}>
              {/* Author header */}
              <View style={styles.modalAuthorRow}>
                {authorAvatar ? (
                  <RNImage source={{ uri: authorAvatar }} style={styles.modalAvatar} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.authorName, { color: colors.text }]}>{post.author.name}</Text>
                    {badge && (
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.metaSub, { color: colors.textTertiary }]}>
                    {timeAgo(post.timestamp)}{post.location ? ` · ${post.location}` : ''}
                  </Text>
                </View>
              </View>

              {/* Caption */}
              {(post.type === 'live' && post.title) ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.caption, { color: colors.text, fontWeight: '700', fontSize: 17 }]}>{post.title}</Text>
                  <Text style={[styles.caption, { color: colors.textSecondary, marginTop: 4 }]}>{post.caption}</Text>
                </View>
              ) : (
                <Text style={[styles.caption, { color: colors.text, marginTop: 12, fontSize: 15 }]}>{post.caption}</Text>
              )}

              {/* Media */}
              {post.media && (
                <View style={post.type === 'live' ? styles.liveMediaWrap : styles.mediaWrap}>
                  <RNImage
                    source={{ uri: post.media }}
                    style={[styles.modalMedia, { height: post.type === 'live' ? 280 : 400 }]}
                    resizeMode="cover"
                  />
                  {post.type === 'video' && post.videoUrl && (
                    <TouchableOpacity style={styles.playOverlay} onPress={() => {
                      // TODO: wire expo-av video player
                      Alert.alert('Coming Soon', 'Video playback will be available soon.');
                    }}>
                      <View style={[styles.playBtn, { width: 56, height: 56, borderRadius: 28 }]}>
                        <Play size={24} color="#FFF" fill="#FFF" style={{ marginLeft: 2 }} />
                      </View>
                    </TouchableOpacity>
                  )}
                  {post.type === 'live' && (
                    <View style={styles.liveOverlay}>
                      <View style={styles.livePill}>
                        <View style={styles.liveDotWhite} />
                        <Text style={styles.livePillText}>LIVE</Text>
                      </View>
                      <View style={styles.liveInfo}>
                        <View style={styles.liveInfoPill}>
                          <Eye size={11} color="#FFF" />
                          <Text style={styles.liveInfoText}>{formatViewers(post.viewerCount || 0)}</Text>
                        </View>
                        <Text style={styles.liveInfoText}>{post.streamDuration}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Event/Plan meta */}
              {(post.type === 'event' || post.type === 'plan') && (
                <View style={[styles.metaRow, { marginTop: 12 }]}>
                  {post.date && (
                    <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                      <Clock size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{post.date}</Text>
                    </View>
                  )}
                  {post.location && (
                    <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                      <MapPin size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{post.location}</Text>
                    </View>
                  )}
                  {post.attendees != null && (
                    <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                      <Users size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                        {post.attendees}/{post.maxAttendees}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Tags */}
              <View style={[styles.tagRow, { marginTop: 10 }]}>
                {post.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.accent + '10' }]}>
                    <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
                  </View>
                ))}
              </View>

              {/* Actions bar */}
              <View style={[styles.detailActions, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.detailActionBtn}
                  onPress={() => { toggleLike(post.id, post.likes ?? 0); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Star size={20} color={liked ? '#EF4444' : colors.textTertiary} fill={liked ? '#EF4444' : 'none'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailActionBtn} onPress={() => inputRef.current?.focus()}>
                  <MessagesSquare size={20} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailActionBtn} onPress={() => onSave(post.id)}>
                  <Bookmark size={20} color={colors.textTertiary} />
                </TouchableOpacity>
                {post.type === 'live' && (
                  <TouchableOpacity style={[styles.joinBtn, { backgroundColor: '#EF4444', marginLeft: 'auto' }]} onPress={() => onWatch(post.id)}>
                    <Play size={14} color="#FFF" fill="#FFF" />
                    <Text style={styles.joinBtnText}>Watch Live</Text>
                  </TouchableOpacity>
                )}
                {(post.type === 'event' || post.type === 'plan') && (
                  <TouchableOpacity style={[styles.joinBtn, { backgroundColor: colors.accent, marginLeft: 'auto' }]} onPress={() => onJoin(post.id)}>
                    <Users size={14} color="#FFF" />
                    <Text style={styles.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                )}
                {post.type === 'achievement' && (
                  <TouchableOpacity style={[styles.celebrateBtn, { marginLeft: 'auto' }]} onPress={() => onCelebrate(post.id)}>
                    <Sparkles size={14} color="#10B981" />
                    <Text style={[styles.celebrateBtnText, { color: '#10B981' }]}>Celebrate</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Comments header */}
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.commentsHeader, { color: colors.text }]}>
                  Comments ({localComments.length})
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item: comment }) => (
            <View style={styles.commentItem}>
              <RNImage source={{ uri: comment.user.name === 'You' ? commentAvatar : comment.user.avatar }} style={styles.commentAvatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.commentBubble}>
                  <Text style={[styles.commentName, { color: colors.text }]}>{comment.user.name}</Text>
                  <Text style={[styles.commentText, { color: colors.textSecondary }]}>{comment.text}</Text>
                </View>
                <Text style={[styles.commentTime, { color: colors.textTertiary }]}>{comment.timestamp}</Text>
              </View>
            </View>
          )}
        />

        {/* Comment input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.bottom}>
          <View style={[styles.commentInput, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 4 }]}>
            <RNImage
              source={{ uri: commentAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }}
              style={styles.commentInputAvatar}
            />
            <TextInput
              style={[styles.commentInputField, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: commentText.trim() ? colors.accent : colors.surface }]} onPress={handleSendComment}>
              <Send size={16} color={commentText.trim() ? '#FFF' : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
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
  onWatch,
  onJoin,
  onCelebrate,
  onTagTap,
  onMediaTap,
  onShare,
  onDelete,
  isSaved: isSavedProp,
}: {
  post: FeedPost;
  colors: any;
  onPress: () => void;
  onSave: (postId: string) => void;
  onComment: (post: FeedPost) => void;
  onWatch: (postId: string) => void;
  onJoin: (postId: string) => void;
  onCelebrate: (postId: string) => void;
  onTagTap: (tag: string) => void;
  onMediaTap: (uri: string) => void;
  onShare: (post: FeedPost) => void;
  onDelete?: (postId: string) => void;
  isSaved?: boolean;
}) {
  const [saved, setSaved] = useState(isSavedProp ?? false);
  // Sync with parent if savedIds changes externally
  useEffect(() => { setSaved(isSavedProp ?? false); }, [isSavedProp]);
  const { interactions, toggleLike } = useSocial();
  const interaction = interactions[post.id];
  const liked = interaction?.isLiked ?? false;
  const likeCount = interaction?.likeCount ?? (post.likes ?? 0);
  const authorAvatar = post.author.avatar || '';
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const routerFromCard = useRouter();

  const handleSave = () => {
    setSaved(!saved);
    onSave(post.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLike = () => {
    // Pass post.likes as initialLikeCount so aggregated posts (marketplace, bundles, etc.)
    // don't reset to 0 on first interaction
    toggleLike(post.id, post.likes ?? 0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Report', style: 'destructive', onPress: () => { Alert.alert('Report submitted', 'Thank you. We will review this content.'); } },
      { text: 'Hide', onPress: () => { onDelete?.(post.id); } },
      { text: 'Copy Link', onPress: () => { Share.share({ message: `Check this out: ${post.caption}` }); } },
    ];
    if (onDelete) {
      options.push({
        text: 'Delete Post',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Delete Post',
            'Are you sure you want to delete this post? This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => onDelete(post.id),
              },
            ],
            { cancelable: true },
          );
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post Options', `By ${post.author.name}`, options, { cancelable: true });
  };

  const typeLabel = (() => {
    switch (post.type) {
      case 'live': return 'LIVE';
      case 'event': return 'Event';
      case 'plan': return 'Plan';
      case 'marketplace': return post.price != null ? `$${post.price}` : 'For Sale';
      case 'rental': return post.pricePerNight || 'For Rent';
      case 'swap': return 'Trade';
      case 'bundle': return 'Bundle';
      default: return null;
    }
  })();

  const handleProfileTap = () => {
    if (!post.author.userId) return;
    // Your own avatar → go to your actual profile tab, not the /user/ viewer
    if (authUser?.id && post.author.userId === authUser.id) {
      routerFromCard.push('/(tabs)/profile' as any);
    } else {
      routerFromCard.push(`/(tabs)/profile?userId=${post.author.userId}` as any);
    }
  };

  return (
    <View style={[igCardStyles.card, { backgroundColor: colors.surface }]}>
      {/* Header — Instagram style: circle avatar + username + location */}
      <View style={igCardStyles.header}>
        <TouchableOpacity style={igCardStyles.headerLeft} onPress={handleProfileTap}>
          {authorAvatar ? (
            <RNImage source={{ uri: authorAvatar }} style={igCardStyles.avatar} />
          ) : null}
          <View style={igCardStyles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[igCardStyles.username, { color: colors.text }]}>{post.author.name}</Text>
              {typeLabel && (
                <Text style={[igCardStyles.typeLabel, { color: colors.textTertiary }]}>· {typeLabel}</Text>
              )}
            </View>
            {post.location ? (
              <Text style={[igCardStyles.location, { color: colors.textTertiary }]}>{post.location}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={igCardStyles.menuBtn} onPress={handleMenuPress}>
          <Text style={[igCardStyles.menuDots, { color: colors.textSecondary }]}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Media — Reels-style 9:16 portrait container */}
      {post.media ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onMediaTap(post.media!)}>
          <RNImage
            source={{ uri: post.media }}
            style={[
              igCardStyles.media,
              {
                height: post.type === 'live' ? 240 : FEED_MEDIA_HEIGHT,
              },
            ]}
            resizeMode="cover"
          />
          {post.type === 'video' && post.videoUrl && (
            <TouchableOpacity style={igCardStyles.playOverlay} onPress={() => {
              Alert.alert('Coming Soon', 'Video playback will be available soon.');
            }}>
              <View style={igCardStyles.playBtn}>
                <Play size={22} color="#FFF" fill="#FFF" style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>
          )}
          {post.type === 'video' && !post.videoUrl && (
            <View style={igCardStyles.playOverlay}>
              <View style={igCardStyles.playBtn}>
                <Play size={22} color="#FFF" fill="#FFF" style={{ marginLeft: 3 }} />
              </View>
            </View>
          )}
          {post.type === 'live' && (
            <View style={igCardStyles.liveOverlay}>
              <View style={igCardStyles.liveBadge}>
                <View style={igCardStyles.liveDot} />
                <Text style={igCardStyles.liveText}>LIVE</Text>
              </View>
              <View style={igCardStyles.liveInfoRow}>
                <View style={igCardStyles.liveCountBadge}>
                  <Eye size={11} color="#FFF" />
                  <Text style={igCardStyles.liveCountText}>{formatViewers(post.viewerCount || 0)}</Text>
                </View>
                <Text style={igCardStyles.liveCountText}>{post.streamDuration}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      {/* Text-only post: larger caption area */}
      {!post.media && post.caption ? (
        <View style={igCardStyles.textOnlyArea}>
          <Text style={[igCardStyles.textOnlyCaption, { color: colors.text }]} numberOfLines={6}>
            {post.caption}
          </Text>
        </View>
      ) : null}

      {/* Action Bar — Instagram style: ♡ 💬 ✈  |  🔖 */}
      <View style={igCardStyles.actionBar}>
        <View style={igCardStyles.actionLeft}>
          <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={handleLike}>
            <Star size={26} color={liked ? '#EF4444' : colors.text} fill={liked ? '#EF4444' : 'none'} />
          </TouchableOpacity>
          <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={() => onComment(post)}>
            <MessagesSquare size={26} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={() => onShare(post)}>
            <Forward size={23} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={igCardStyles.actionIconBtn} onPress={handleSave}>
          <Bookmark size={26} color={colors.text} fill={saved ? colors.text : 'none'} />
        </TouchableOpacity>
      </View>

      {/* Likes count */}
      <View style={igCardStyles.likesRow}>
        <Text style={[igCardStyles.likesText, { color: colors.text }]}>
          {liked ? (
            <>Liked by <Text style={{ fontWeight: '700' }}>you</Text>{likeCount > 1 ? <> and{' '}<Text style={{ fontWeight: '700' }}>{likeCount - 1} {likeCount - 1 === 1 ? 'other' : 'others'}</Text></> : null}</>
          ) : (
            <><Text style={{ fontWeight: '700' }}>{likeCount}</Text> {likeCount === 1 ? 'like' : 'likes'}</>
          )}
        </Text>
      </View>

      {/* Caption — with bold username like Instagram */}
      {post.caption && post.media ? (
        <View style={igCardStyles.captionRow}>
          <Text style={[igCardStyles.captionText, { color: colors.text }]} numberOfLines={3}>
            <Text style={{ fontWeight: '700' }}>{post.author.name}</Text>{' '}
            {post.caption}
          </Text>
          {post.tags.length > 0 && (
            <View style={igCardStyles.tagRow}>
              {post.tags.slice(0, 3).map((tag) => (
                <TouchableOpacity key={tag} onPress={() => onTagTap(tag)}>
                  <Text style={[igCardStyles.hashTag, { color: '#00376B' }]}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Event/Plan meta — subtle under caption */}
      {(post.type === 'event' || post.type === 'plan') && (
        <View style={igCardStyles.eventMeta}>
          {post.date && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={colors.textTertiary} />
              <Text style={[igCardStyles.eventMetaText, { color: colors.textTertiary }]}>{post.date}</Text>
            </View>
          )}
          {post.attendees != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users size={12} color={colors.textTertiary} />
              <Text style={[igCardStyles.eventMetaText, { color: colors.textTertiary }]}>
                {post.attendees}/{post.maxAttendees}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Comments link */}
      {(post.stats.comments > 0 || post.comments_list?.length) && (
        <TouchableOpacity style={igCardStyles.commentsLink} onPress={() => onComment(post)}>
          <Text style={[igCardStyles.commentsLinkText, { color: colors.textTertiary }]}>
            View all {post.stats.comments || post.comments_list?.length || 0} comments
          </Text>
        </TouchableOpacity>
      )}

      {/* Timestamp */}
      <View style={igCardStyles.timestampRow}>
        <Text style={[igCardStyles.timestamp, { color: colors.textTertiary }]}>
          {timeAgo(post.timestamp)}
        </Text>
        {/* Type-specific CTA pill */}
        {post.type === 'live' ? (
          <TouchableOpacity style={[igCardStyles.ctaPill, { backgroundColor: '#EF4444' }]} onPress={() => onWatch(post.id)}>
            <Play size={11} color="#FFF" fill="#FFF" />
            <Text style={igCardStyles.ctaPillText}>Watch Live</Text>
          </TouchableOpacity>
        ) : post.type === 'event' || post.type === 'plan' ? (
          <TouchableOpacity style={[igCardStyles.ctaPill, { backgroundColor: colors.accent }]} onPress={() => onJoin(post.id)}>
            <Users size={11} color="#FFF" />
            <Text style={igCardStyles.ctaPillText}>Join</Text>
          </TouchableOpacity>
        ) : post.type === 'marketplace' ? (
          <TouchableOpacity style={[igCardStyles.ctaPill, { backgroundColor: '#10B981' }]} onPress={onPress}>
            <ShoppingBag size={11} color="#FFF" />
            <Text style={igCardStyles.ctaPillText}>View</Text>
          </TouchableOpacity>
        ) : post.type === 'bundle' ? (
          <TouchableOpacity style={[igCardStyles.ctaPill, { backgroundColor: '#8B5CF6' }]} onPress={onPress}>
            <Package size={11} color="#FFF" />
            <Text style={igCardStyles.ctaPillText}>Grab</Text>
          </TouchableOpacity>
        ) : post.type === 'achievement' ? (
          <TouchableOpacity style={[igCardStyles.ctaPill, { backgroundColor: '#10B981' }]} onPress={() => onCelebrate(post.id)}>
            <Sparkles size={11} color="#FFF" />
            <Text style={igCardStyles.ctaPillText}>Celebrate</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Create Post Modal
// ═══════════════════════════════════════════════════════════════════════════
// Main Feed Screen
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { handleScroll: handleTabBarScroll, hideTabBar, showTabBar } = useTabBar();
  const { user: authUser } = useAuth();
  const userAvatar = authUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';
  const { addUserPost } = useUserPosts();
  const { deletePost, createPost, toggleLike, feedStories, userStories, createStory, getAllPosts } = useSocial();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [searchFollowingIds, setSearchFollowingIds] = useState<Set<string>>(new Set());
  const [searchUserLoading, setSearchUserLoading] = useState(false);
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

  // Load saved post IDs from Supabase
  useEffect(() => {
    if (!authUser?.id) return;
    supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).then(({ data, error }) => {
      if (!error && data) setSavedIds(new Set((data as any[]).map(r => r.post_id)));
    });
  }, [authUser?.id]);

  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set());
  // Load ALL posts from SocialContext for the feed — all users, not just current.
  // Re-runs whenever getAllPosts changes (query refetch, new posts, etc.)
  const lastPostCountRef = useRef(0);
  useEffect(() => {
    const posts = getAllPosts();
    if (!posts || posts.length === 0) return;
    // Only update if post list actually changed (avoids unnecessary re-renders)
    if (posts.length === lastPostCountRef.current) return;
    const allPosts: FeedPost[] = posts
      .map((p: any) => ({
        id: p.id,
        type: p.type || 'photo',
        author: { name: p.user?.name || p.author_name || 'Unknown', avatar: p.user?.avatar || '', userId: p.user?.id || p.user_id },
        category: p.category || 'General',
        timestamp: p.timestamp || p.created_at || '',
        caption: p.content || p.caption || '',
        media: p.imageUrl || p.image_url || p.mediaUri || '',
        likes: p.likes || 0,
        tags: p.tags || [],
        stats: { saves: p.saves || 0, comments: (p.comments || []).length },
      }));
    if (allPosts.length > 0) {
      setUserPosts(allPosts);
      lastPostCountRef.current = posts.length;
    }
  }, [getAllPosts]);

  const queryClient = useQueryClient();
  const [userPosts, setUserPosts] = useState<FeedPost[]>([]);
  const userPostIds = useMemo(() => new Set(userPosts.map(p => p.id)), [userPosts]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [viewerMedia, setViewerMedia] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Clear initial load state after first render
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // ── User search (debounced with request ordering) ──
  const searchRequestIdRef = useRef(0);
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchUsers([]);
      return;
    }
    const requestId = ++searchRequestIdRef.current;
    const timer = setTimeout(async () => {
      setSearchUserLoading(true);
      const pattern = `%${searchQuery.trim()}%`;
      const { data } = await supabase
        .from('users')
        .select('id, name, username, avatar, is_verified, followers_count')
        .or(`name.ilike.${pattern},username.ilike.${pattern}`)
        .limit(8);
      // Discard stale results if a newer request was already fired
      if (requestId !== searchRequestIdRef.current) return;
      if (data) {
        setSearchUsers(data);
        if (authUser?.id && data.length > 0) {
          const ids = data.map((u: any) => u.id).filter((id: string) => id !== authUser.id);
          if (ids.length > 0) {
            const { data: followData } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', authUser.id)
              .in('following_id', ids);
            // Also check request ordering for the follow-data sub-query
            if (requestId === searchRequestIdRef.current) {
              setSearchFollowingIds(new Set((followData || []).map((f: any) => f.following_id)));
            }
          }
        }
      }
      if (requestId === searchRequestIdRef.current) setSearchUserLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, authUser?.id]);

  const handleToggleFollow = async (targetUserId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isFollowing = searchFollowingIds.has(targetUserId);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', authUser!.id).eq('following_id', targetUserId);
        setSearchFollowingIds(prev => { const n = new Set(prev); n.delete(targetUserId); return n; });
      } else {
        await supabase.from('follows').insert({ follower_id: authUser!.id, following_id: targetUserId });
        setSearchFollowingIds(prev => new Set(prev).add(targetUserId));
      }
    } catch (_) {}
  };

  // ── Promoted external events (admin-managed) ──
  const externalEvents = useMemo(() => EXTERNAL_EVENTS.map((ev) => ({
    ...ev,
    // Compute correct day-of-week dynamically instead of hardcoded 2025 labels
    displayDate: (() => {
      try {
        const d = new Date(ev.date);
        if (isNaN(d.getTime())) return ev.date;
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } catch { return ev.date; }
    })(),
  })), []);

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

    // Add feed stories
    feedStories.forEach(s => {
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
  }, [userStories, feedStories]);

  const filteredPosts = useMemo(() => {
    // ── Deduplication: prefer context data over hardcoded ──
    const seenIds = new Set<string>();
    const seenContentKeys = new Set<string>();
    const deduped: FeedPost[] = [];

    const isDuplicate = (post: FeedPost): boolean => {
      if (seenIds.has(post.id)) return true;
      // Near-duplicate detection: only for posts with actual text content
      const caption = (post.title || post.caption || '').toLowerCase().trim();
      if (caption) {
        const contentKey = `${caption}|${post.author.name.toLowerCase().trim()}`;
        if (seenContentKeys.has(contentKey)) return true;
      }
      return false;
    };

    const addPost = (post: FeedPost) => {
      if (isDuplicate(post)) return;
      seenIds.add(post.id);
      const caption = (post.title || post.caption || '').toLowerCase().trim();
      if (caption) {
        seenContentKeys.add(`${caption}|${post.author.name.toLowerCase().trim()}`);
      }
      deduped.push(post);
    };

    // Only social posts in feed — no commercial/listing content
    userPosts.forEach(addPost);

    let all = deduped;
    if (activeFilter !== 'all') all = all.filter((p) => p.type === activeFilter);
    if (tagFilter) all = all.filter((p) => p.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase())));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      all = all.filter(p => (p.caption || p.title || '').toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
    }
    // Shuffle on refresh
    if (refreshKey > 0 && activeFilter === 'all' && !tagFilter) {
      all = [...all].sort(() => Math.random() - 0.5);
    }
    return all;
  }, [activeFilter, userPosts, tagFilter, searchQuery, refreshKey]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTagFilter(null);
    // Invalidate Supabase query cache so fresh data is fetched from the server
    queryClient.invalidateQueries({ queryKey: ['supabasePosts'] });
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, [queryClient]);

  const handleSavePost = (postId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
        // Remove from Supabase
        if (authUser?.id) supabase.from('saved_posts').delete().eq('user_id', authUser.id).eq('post_id', postId).then(({ error }) => {
          if (error) console.warn('[Feed] Unsave failed:', error.message);
        });
      } else {
        next.add(postId);
        // Save to Supabase
        if (authUser?.id) supabase.from('saved_posts').insert({ user_id: authUser.id, post_id: postId, created_at: new Date().toISOString() }).then(({ error }) => {
          if (error) console.warn('[Feed] Save failed:', error.message);
        });
      }
      return next;
    });
  };

  const handleJoinPost = (postId: string) => {
    setJoinedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleWatchLive = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to Spot tab
    router.push('/(tabs)/live');
  };

  const handleCelebrate = (postId: string) => {
    const isAdding = !celebratedIds.has(postId);
    setCelebratedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isAdding) {
      Alert.alert('🎉 Celebrated!', 'You showed some love.');
    }
  };

  const handleSharePost = async (post: FeedPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: post.title ? `${post.title}\n\n${post.caption}` : post.caption,
        url: post.media,
      });
    } catch (err) {
      // user cancelled share — ignore
    }
  };

  const handleDeletePost = (postId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deletePost(postId);
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleEventCardPress = (event: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Event detail page removed — navigate to external URL if available
    if (event.externalUrl) {
      router.push(event.externalUrl as any);
    }
  };

  const importVideoRef = useRef<any>(null);
  const Video = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    try {
      const av = require('expo-av');
      if (!cancelled) { Video.current = av.Video; importVideoRef.current = av; }
    } catch (_) {}
    return () => { cancelled = true; };
  }, []);

  const handleCreatePost = (data: { caption: string; mediaUri?: string; mediaWidth?: number; mediaHeight?: number; category?: string }) => {
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = new Date().toISOString();

    // Display at 9:16 Reels proportions (1080×1920) — media fills with center crop
    let displayHeight: number | undefined;
    let displayWidth: number | undefined;
    if (data.mediaWidth && data.mediaHeight && data.mediaWidth > 0) {
      displayHeight = FEED_MEDIA_HEIGHT;
      displayWidth = SCREEN_WIDTH;
    }

    const newPost: FeedPost = {
      id,
      type: 'photo',
      author: {
        name: 'You',
        avatar: userAvatar,
        userId: authUser?.id,
      },
      category: data.category || createCategory || 'General',
      timestamp: 'Just now',
      caption: data.caption,
      media: data.mediaUri,
      mediaWidth: displayWidth,
      mediaHeight: displayHeight,
      likes: 0,
      tags: createCategory ? [createCategory] : [],
      stats: { saves: 0, comments: 0 },
    };

    // Add to feed
    setUserPosts((prev) => [newPost, ...prev]);

    // Persist to SocialContext so posts appear in getAllPosts() and profile grid.
    // Fire-and-forget: if the DB write fails, the post still shows locally.
    try { createPost(data.caption, data.mediaUri, undefined); } catch (err: any) {
      console.warn('[Feed] createPost failed (post will show locally):', err?.message || err);
    }

    // Share to profile
    addUserPost({
      id,
      caption: data.caption,
      mediaUri: data.mediaUri,
      timestamp,
    });

    // Close modals
    setShowCreate(false);
    setCreatePreloadMedia(null);
    setCreateCategory(null);
  };

  // ── Camera flow (Instagram-style viewfinder) ──
  const handleCreateTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    hideTabBar();
    setShowCamera(true);
  };

  // Called when user captures from InstagramCamera
  const handleCameraCapture = (media: CapturedMedia) => {
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
      setCreatePreloadMedia(asset.uri);
      setCreateMediaType(asset.type === 'video' ? 'video' : 'photo');
      if (asset.type === 'video' && asset.duration && asset.duration > 60000) {
        Alert.alert('Video too long', 'Please select a video under 60 seconds.');
        return;
      }
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
    setActiveFilter('all');
  };

  const liveCount = useMemo(() => userPosts.filter((p) => p.type === 'live').length, [userPosts]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Feed</Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              {tagFilter ? `#${tagFilter} · ` : ''}{filteredPosts.length} posts{activeFilter === 'all' && !tagFilter && liveCount > 0 ? ` · ${liveCount} live` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.accent }]}
              onPress={handleCreateTap}
            >
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/inbox')}
            >
              <MessageCircle size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const isActive = activeFilter === f.key;
            const isLive = f.key === 'live';
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? (isLive ? '#EF4444' : colors.accent) : colors.surface,
                    borderColor: isActive ? (isLive ? '#EF4444' : colors.accent) : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveFilter(f.key);
                }}
              >
                {isLive && <View style={[styles.filterLiveDot, { backgroundColor: isActive ? '#FFF' : '#EF4444' }]} />}
                <Icon size={13} color={isActive ? '#FFF' : colors.textSecondary} />
                <Text style={[styles.filterText, { color: isActive ? '#FFF' : colors.textSecondary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tag filter active indicator */}
      {tagFilter && (
        <View style={[styles.tagFilterBar, { borderBottomColor: colors.border }]}>
          <View style={[styles.tagFilterPill, { backgroundColor: colors.accent + '15' }]}>
            <Text style={[styles.tagFilterText, { color: colors.accent }]}>#{tagFilter}</Text>
            <TouchableOpacity onPress={() => setTagFilter(null)}>
              <X size={12} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isInitialLoad ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          <SkeletonCard count={5} shimmerColor={colors.accent + '30'} baseColor={colors.surface} />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              colors={colors}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedPost(item);
              }}
              onSave={handleSavePost}
              onComment={handleComment}
              onWatch={handleWatchLive}
              onJoin={handleJoinPost}
              onCelebrate={handleCelebrate}
              onShare={handleSharePost}
              onTagTap={handleTagTap}
              onMediaTap={(uri) => setViewerMedia(uri)}
              onDelete={userPostIds.has(item.id) ? () => handleDeletePost(item.id) : undefined}
              isSaved={savedIds.has(item.id)}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={() => (
          <View>
            <View style={{ height: 6 }} />

            {/* ── Stories Row ── */}
            {storyUsers.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                {/* Your Story / Add Story */}
                <StoryRing
                  avatar={userAvatar}
                  name="Your Story"
                  hasUnviewed={false}
                  isAddStory
                  onPress={() => setShowCreateStory(true)}
                />
                {/* Other users' stories */}
                {storyUsers.map((storyUser, idx) => (
                  <StoryRing
                    key={storyUser.userId}
                    avatar={storyUser.avatar}
                    name={storyUser.name === 'You' ? 'Your Story' : storyUser.name}
                    hasUnviewed
                    onPress={() => {
                      setStoryViewerStartIndex(idx);
                      setShowStoriesViewer(true);
                    }}
                  />
                ))}
              </ScrollView>
            )}

            {/* ── Search Bar ── */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}>
                <Search size={16} color={colors.textTertiary} />
                <TextInput
                  style={{ flex: 1, marginLeft: 8, fontSize: 14, color: colors.text }}
                  placeholder="Search posts and users..."
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── For You Row ── */}
            {activeFilter === 'all' && !tagFilter && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={15} color={colors.accent} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>For You</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                    {filteredPosts.length} opportunities
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
                  {filteredPosts.slice(0, 5).map((post) => (
                    <TouchableOpacity
                      key={`fy-${post.id}`}
                      style={{
                        width: 160,
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 12,
                        gap: 6,
                      }}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPost(post); }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent, textTransform: 'uppercase' }}>
                        {post.type === 'marketplace' ? 'For Sale' : post.type === 'rental' ? 'Rental' : post.type === 'swap' ? 'Trade' : post.type === 'event' ? 'Event' : post.type}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={2}>
                        {post.title || post.caption}
                      </Text>
                      {post.location ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <MapPin size={10} color={colors.textTertiary} />
                          <Text style={{ fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>{post.location}</Text>
                        </View>
                      ) : null}
                      {post.price != null && (
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 'auto' }}>
                          ${post.price}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Happening This Week ── */}
            {externalEvents.length > 0 && activeFilter === 'all' && !tagFilter && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 10 }}>
                  <Calendar size={15} color="#EF4444" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Happening This Week</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
                  {externalEvents.slice(0, 6).map((event: any) => (
                    <TouchableOpacity
                      key={event.id}
                      style={{
                        width: 200,
                        borderRadius: 16,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: 'hidden',
                      }}
                      onPress={() => handleEventCardPress(event)}
                    >
                      {event.image ? (
                        <RNImage source={{ uri: event.image }} style={{ width: '100%', height: 100 }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: '100%', height: 100, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={28} color={colors.accent} />
                        </View>
                      )}
                      <View style={{ padding: 10, gap: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent, textTransform: 'uppercase' }}>
                          {event.category || 'Event'}{event.is_free ? ' · FREE' : ''}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>
                          {event.displayDate || event.date}{event.venue ? ` · ${event.venue}` : ''}
                        </Text>
                        {event.price && <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{event.price}</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ height: 4 }} />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <FileText size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No posts yet</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
              {tagFilter ? `No posts tagged #${tagFilter}.` : `Nothing here for "${activeFilter}" right now.`}
            </Text>
          </View>
        )}
      />
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          visible={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          colors={colors}
          onSave={handleSavePost}
          onJoin={handleJoinPost}
          onWatch={handleWatchLive}
          onCelebrate={handleCelebrate}
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
          {viewerMedia && (
            <RNImage source={{ uri: viewerMedia }} style={styles.viewerImage} resizeMode="cover" />
          )}
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
  // Header
  header: { paddingHorizontal: 16, paddingBottom: 6, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  // Filters
  filterScroll: { marginTop: 10, marginBottom: 6 },
  filterContent: { gap: 8, paddingRight: 16 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  filterLiveDot: { width: 5, height: 5, borderRadius: 3 },
  // Card
  card: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 14, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' },
  metaSub: { fontSize: 12, marginTop: 1.5 },
  // Caption
  caption: { fontSize: 14, lineHeight: 21 },
  // Media
  mediaWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mediaImg: { width: '100%', borderRadius: 12 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  // Live media
  liveMediaWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative', marginTop: 8 },
  liveOverlay: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  liveDotWhite: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  livePillText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  liveInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveInfoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  liveInfoText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  // Meta
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaChipText: { fontSize: 11, fontWeight: '600' },
  // Tags
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  tagText: { fontSize: 11, fontWeight: '500' },
  // Actions
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '600' },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  joinBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  celebrateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  celebrateBtnText: { fontSize: 13, fontWeight: '700' },
  // List
  listContent: { paddingBottom: 100 },
  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
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
  commentsHeader: { fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  // Comments in modal
  commentItem: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
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
  liveOverlay: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  liveInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  liveCountText: { fontSize: 10, fontWeight: '600', color: '#FFF' },
  textOnlyArea: { paddingHorizontal: 16, paddingVertical: 24, minHeight: 120, justifyContent: 'center' },
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
  eventMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 12, paddingVertical: 4 },
  eventMetaText: { fontSize: 12, fontWeight: '500' },
  commentsLink: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 2 },
  commentsLinkText: { fontSize: 13 },
  timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 14 },
  timestamp: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  ctaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  ctaPillText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
});
