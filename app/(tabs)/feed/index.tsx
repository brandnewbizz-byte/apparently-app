import {
  Calendar, Clock, MapPin, Users, Sparkles, Dumbbell, Utensils, Palette,
  Plane, Heart, Music, Zap, Play, Plus, Eye,
  MessageCircle, CheckCircle2, Wrench, Bookmark,
  Radio, Image as ImageIcon, Video as VideoIcon, FileText, X, Send, ChevronLeft, Camera,
  ShoppingBag, Home, Repeat, DollarSign, UserPlus, Search, Package,
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
import { useTheme } from '@/contexts/ThemeContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useServiceRequests } from '@/contexts/ServiceRequestContext';
import { useSwap } from '@/contexts/SwapContext';
import { useConnections } from '@/contexts/ConnectionsContext';
import { productToFeedPost, listingToFeedPost, swapPostToFeedPost, connectionToFeedPost, requestToFeedPost, bundleToFeedPost, type AggregatedFeedPost } from '@/lib/feedAggregator';
import { useBundles } from '@/contexts/BundleContext';
import { useSocial } from '@/contexts/SocialContext';
import { useUserPosts } from '@/contexts/UserPostsContext';
import { EXTERNAL_EVENTS } from '@/lib/externalEvents';
import SkeletonCard from '@/components/SkeletonCard';
import PostComposer, { POST_CATEGORIES as POST_CATS } from '@/components/PostComposer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Reels-style 9:16 portrait container (1080×1920 proportions)
const FEED_ASPECT = 9 / 16; // width:height
const FEED_MEDIA_HEIGHT = Math.round(SCREEN_WIDTH / FEED_ASPECT);

// ── Types ──────────────────────────────────────────────────────────────────

type PostType = 'text' | 'photo' | 'video' | 'live' | 'event' | 'plan' | 'achievement' | 'marketplace' | 'rental' | 'swap' | 'connection' | 'request' | 'bundle';

interface Comment {
  id: string;
  user: { name: string; avatar: string };
  text: string;
  timestamp: string;
}

interface FeedPost {
  id: string;
  type: PostType;
  title?: string;
  author: { name: string; avatar: string };
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
  stats: { saves: number; comments: number };
  viewerCount?: number;
  streamDuration?: string;
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

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', user: { name: 'Riley Nomad', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100' }, text: 'This is incredible! 🔥', timestamp: '10m ago' },
  { id: 'c2', user: { name: 'Coach Ray', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100' }, text: 'Where can I sign up for the next one?', timestamp: '25m ago' },
  { id: 'c3', user: { name: 'Crafty Kate', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }, text: 'Love seeing this kind of content on here 🙌', timestamp: '1h ago' },
  { id: 'c4', user: { name: 'Marcus Beats', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' }, text: 'Respect! Keep grinding 💪', timestamp: '1h ago' },
  { id: 'c5', user: { name: 'Lena Wellness', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }, text: 'The vibes are immaculate ✨', timestamp: '2h ago' },
];

const FEED_POSTS: FeedPost[] = [
  // ── LIVE STREAMS ──
  {
    id: 'live-1', type: 'live', title: 'Sunday Jazz & Lo-Fi Session 🎷',
    caption: 'Live from Brooklyn. Chilled beats, good vibes, taking requests.',
    author: { name: 'Marcus Beats', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    category: 'Entertainment', timestamp: 'Live now',
    media: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
    viewerCount: 1247, streamDuration: '42m streaming',
    tags: ['Jazz', 'Lo-Fi', 'Live'], stats: { saves: 56, comments: 89 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'live-2', type: 'live', title: 'Morning Yoga Flow — All Levels 🧘',
    caption: 'Join live for a guided flow. Modifications shown for every pose.',
    author: { name: 'Lena Wellness', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    category: 'Wellness', timestamp: 'Live now',
    media: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600',
    viewerCount: 892, streamDuration: '18m streaming',
    tags: ['Yoga', 'Morning', 'Wellness'], stats: { saves: 112, comments: 34 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'live-3', type: 'live', title: 'NYC Night Photography Walk 📸',
    caption: 'Exploring Times Square at night — gear talk and shooting tips.',
    author: { name: 'Lisa Captures', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    category: 'Creative', timestamp: 'Live now',
    media: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600',
    viewerCount: 456, streamDuration: '1h 5m streaming',
    tags: ['Photography', 'NYC', 'Night'], stats: { saves: 34, comments: 18 },
    comments_list: MOCK_COMMENTS,
  },
  // ── PHOTO POSTS ──
  {
    id: 'photo-1', type: 'photo', category: 'Creative', timestamp: '2h ago',
    author: { name: 'Crafty Kate', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
    caption: 'Just unloaded the kiln. This batch came out perfect — loving how the ocean blue glaze settled in the ridges.',
    media: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600', mediaHeight: 340,
    tags: ['Ceramics', 'Handmade'], stats: { saves: 52, comments: 15 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'photo-2', type: 'photo', category: 'Fitness', timestamp: '4h ago',
    author: { name: 'Fit With Zoe', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
    caption: 'Morning set done by 7. 315x5 felt light today — the program is working.',
    media: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600', mediaHeight: 340,
    tags: ['Training', 'Morning'], stats: { saves: 23, comments: 8 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'photo-3', type: 'photo', category: 'Dining', timestamp: '5h ago',
    author: { name: 'Chef Tony', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
    caption: 'Pistachio-crusted salmon with saffron risotto. Off-menu special tonight only.',
    media: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600', mediaHeight: 340,
    tags: ['Cooking', 'Seafood'], stats: { saves: 78, comments: 31 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'photo-4', type: 'photo', category: 'Travel', timestamp: '8h ago',
    author: { name: 'Riley Nomad', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100' },
    caption: 'Golden hour hits different in Santorini. Never gets old.',
    media: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=600', mediaHeight: 420,
    location: 'Santorini, Greece',
    tags: ['Travel', 'Sunset', 'Greece'], stats: { saves: 134, comments: 42 },
    comments_list: MOCK_COMMENTS,
  },
  // ── VIDEO POSTS ──
  {
    id: 'video-1', type: 'video', category: 'Entertainment', timestamp: '1h ago',
    author: { name: 'DJ Aria', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    caption: 'Preview of Friday\'s rooftop set. This transition has been living rent-free in my head all week.',
    media: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600', mediaHeight: 420,
    tags: ['DJ', 'Music', 'Preview'], stats: { saves: 67, comments: 23 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'video-2', type: 'video', category: 'Fitness', timestamp: '6h ago',
    author: { name: 'Coach Ray', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100' },
    caption: 'Quick form check — 3 common deadlift mistakes and how to fix them in 60 seconds.',
    media: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600', mediaHeight: 420,
    tags: ['Tutorial', 'Form', 'Fitness'], stats: { saves: 91, comments: 34 },
    comments_list: MOCK_COMMENTS,
  },
  // ── TEXT POSTS ──
  {
    id: 'text-1', type: 'text', category: 'Wellness', timestamp: '3h ago',
    author: { name: 'Lena Wellness', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    caption: 'Day 30 of no sugar. Here\'s what I learned:\n\n1. First week is hell. Push through.\n2. Fruit tastes like candy now. No joke.\n3. Sleep improved dramatically by week 2.\n4. Skin cleared up. Didn\'t expect that.\n5. Energy is steady all day — no crashes.\n\nIf you\'re on the fence, just try 2 weeks.',
    tags: ['Health', 'No Sugar', 'Journey'], stats: { saves: 203, comments: 67 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'text-2', type: 'text', category: 'Creative', timestamp: '9h ago',
    author: { name: 'Lisa Captures', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    caption: 'Unpopular opinion: you don\'t need a $2,000 camera to take great photos. The best camera is the one you have with you. I shot my first paid gig on a used DSLR I got for $300.\n\nLearn composition first. Gear second.',
    tags: ['Photography', 'Advice'], stats: { saves: 156, comments: 48 },
    comments_list: MOCK_COMMENTS,
  },
  // ── EVENTS ──
  {
    id: 'event-1', type: 'event', caption: 'Drinks included with ticket. Skyline views from the 25th floor.',
    author: { name: 'DJ Aria', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    category: 'Entertainment', timestamp: '3h ago',
    date: 'Fri · 8:00 PM', location: 'SoHo Rooftop', attendees: 45, maxAttendees: 60,
    media: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600', mediaHeight: 280,
    tags: ['DJ', 'Rooftop', 'Music'], stats: { saves: 67, comments: 23 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'event-2', type: 'event', caption: 'High intensity interval training. Modifications for all levels. Bring water!',
    author: { name: 'Fit With Zoe', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
    category: 'Fitness', timestamp: '6h ago',
    date: 'Daily · 7:00 AM', location: 'Hudson Yards', attendees: 18, maxAttendees: 25,
    tags: ['HIIT', 'Bootcamp', 'Morning'], stats: { saves: 34, comments: 9 },
    comments_list: MOCK_COMMENTS,
  },
  // ── PLANS ──
  {
    id: 'plan-1', type: 'plan', caption: 'All levels welcome — bring your own mat. We\'ll flow as the sun comes up.',
    author: { name: 'Lena Wellness', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    category: 'Wellness', timestamp: '2h ago',
    date: 'Tomorrow · 6:30 AM', location: 'Central Park, NYC', attendees: 12, maxAttendees: 20,
    media: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600', mediaHeight: 280,
    tags: ['Yoga', 'Outdoors', 'Morning'], stats: { saves: 28, comments: 7 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'plan-2', type: 'plan', caption: 'Hit 4 spots in one afternoon. Fixed-price menu at each stop.',
    author: { name: 'Chef Tony', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
    category: 'Dining', timestamp: '5h ago',
    date: 'Sat · 11:00 AM', location: 'East Village, NYC', attendees: 8, maxAttendees: 15,
    tags: ['Brunch', 'Food Tour', 'Weekend'], stats: { saves: 45, comments: 12 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'plan-3', type: 'plan', caption: 'Capture golden hour at Brooklyn Bridge. Bring any camera — phone, DSLR, film.',
    author: { name: 'Lisa Captures', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    category: 'Creative', timestamp: '8h ago',
    date: 'Sun · 6:00 PM', location: 'Brooklyn Bridge', attendees: 5, maxAttendees: 12,
    tags: ['Photography', 'Sunset', 'Brooklyn'], stats: { saves: 19, comments: 4 },
    comments_list: MOCK_COMMENTS,
  },
  // ── ACHIEVEMENTS ──
  {
    id: 'achieve-1', type: 'achievement', caption: '30 consecutive days of yoga. Never missed a morning. Feeling stronger, calmer, and more flexible than ever. This practice changed my life and I\'m never going back.',
    author: { name: 'Marcus Beats', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    category: 'Wellness', timestamp: '2h ago',
    media: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600', mediaHeight: 300,
    tags: ['Yoga', 'Streak', 'Milestone'], stats: { saves: 0, comments: 31 },
    comments_list: MOCK_COMMENTS,
  },
  {
    id: 'achieve-2', type: 'achievement', caption: '1:52 finish at the Brooklyn Half. The crowd energy was unreal — strangers cheering your name for 13 miles. Already signed up for the full marathon in November.',
    author: { name: 'Fit With Zoe', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
    category: 'Fitness', timestamp: '12h ago',
    tags: ['Running', 'Half Marathon', 'Personal Best'], stats: { saves: 0, comments: 47 },
    comments_list: MOCK_COMMENTS,
  },
];

const FILTERS = [
  { key: 'all', label: 'All', icon: FileText },
  { key: 'live', label: 'Live', icon: Radio },
  { key: 'photo', label: 'Photos', icon: ImageIcon },
  { key: 'video', label: 'Videos', icon: VideoIcon },
  { key: 'event', label: 'Events', icon: Sparkles },
  { key: 'plan', label: 'Plans', icon: Calendar },
];

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
  const [liked, setLiked] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [localComments, setLocalComments] = useState<Comment[]>(post.comments_list || []);
  const cat = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG.Creative;
  const CatIcon = cat.icon;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newComment: Comment = {
      id: `c-new-${Date.now()}`,
      user: { name: 'You', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
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
                <RNImage source={{ uri: post.author.avatar }} style={styles.modalAvatar} />
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
                    {post.timestamp}{post.location ? ` · ${post.location}` : ''}
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
                  {post.type === 'video' && (
                    <View style={styles.playOverlay}>
                      <View style={[styles.playBtn, { width: 56, height: 56, borderRadius: 28 }]}>
                        <Play size={24} color="#FFF" fill="#FFF" style={{ marginLeft: 2 }} />
                      </View>
                    </View>
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
                  onPress={() => { setLiked(!liked); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
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
              <RNImage source={{ uri: comment.user.avatar }} style={styles.commentAvatar} />
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
              source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }}
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
}) {
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);

  const handleSave = () => {
    setSaved(!saved);
    onSave(post.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLike = () => {
    setLiked(!liked);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Report', style: 'destructive', onPress: () => {} },
      { text: 'Hide', onPress: () => {} },
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

  const likeCount = (post.price != null ? Number(post.price) : post.stats.saves) + (liked ? 1 : 0);

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

  return (
    <View style={[igCardStyles.card, { backgroundColor: colors.surface }]}>
      {/* Header — Instagram style: circle avatar + username + location */}
      <View style={igCardStyles.header}>
        <TouchableOpacity style={igCardStyles.headerLeft} onPress={onPress}>
          <RNImage source={{ uri: post.author.avatar }} style={igCardStyles.avatar} />
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
          {post.type === 'video' && (
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
          Liked by <Text style={{ fontWeight: '700' }}>you</Text> and{' '}
          <Text style={{ fontWeight: '700' }}>{likeCount > 0 ? likeCount : 23} others</Text>
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
          {post.timestamp}
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
  const { addUserPost } = useUserPosts();
  const { deletePost } = useSocial();
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createPreloadMedia, setCreatePreloadMedia] = useState<string | null>(null);
  const [createPreloadMediaWidth, setCreatePreloadMediaWidth] = useState<number | undefined>(undefined);
  const [createPreloadMediaHeight, setCreatePreloadMediaHeight] = useState<number | undefined>(undefined);
  const [showCamera, setShowCamera] = useState(false);
  const [createCategory, setCreateCategory] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set());
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

  // ── Cross-tab data ──
  const { products } = useMarketplace();
  const { listings } = useBookings();
  const { posts: swapPosts } = useSwap();
  const { connections } = useConnections();
  const { getOpenRequests } = useServiceRequests();
  const { bundles } = useBundles();

  // Convert cross-tab data into feed posts
  const marketplacePosts = useMemo(() => (products || []).filter((p: any) => p.status === 'active').slice(0, 8).map(productToFeedPost), [products]);
  const rentalPosts = useMemo(() => (listings || []).slice(0, 6).map(listingToFeedPost), [listings]);
  const swapFeedPosts = useMemo(() => (swapPosts || []).filter((p: any) => p.status === 'open').slice(0, 6).map(swapPostToFeedPost), [swapPosts]);
  const connectionPosts = useMemo(() => (connections || []).slice(0, 4).map(connectionToFeedPost), [connections]);
  const requestPosts = useMemo(() => getOpenRequests().slice(0, 8).map(requestToFeedPost), [getOpenRequests]);
  const bundlePosts = useMemo(() => bundles.slice(0, 6).map(bundleToFeedPost), [bundles]);

  const externalEvents = EXTERNAL_EVENTS;

  const filteredPosts = useMemo(() => {
    // ── Deduplication: prefer context data over hardcoded ──
    const seenIds = new Set<string>();
    const seenContentKeys = new Set<string>();
    const deduped: FeedPost[] = [];

    const isDuplicate = (post: FeedPost): boolean => {
      if (seenIds.has(post.id)) return true;
      // Near-duplicate detection: same title/caption + author name
      const contentKey = `${(post.title || post.caption || '').toLowerCase().trim()}|${post.author.name.toLowerCase().trim()}`;
      if (seenContentKeys.has(contentKey)) return true;
      return false;
    };

    const addPost = (post: FeedPost) => {
      if (isDuplicate(post)) return;
      seenIds.add(post.id);
      seenContentKeys.add(`${(post.title || post.caption || '').toLowerCase().trim()}|${post.author.name.toLowerCase().trim()}`);
      deduped.push(post);
    };

    // Priority order: user-created posts first, then context data (preferred over hardcoded), then hardcoded last
    userPosts.forEach(addPost);

    // Context data — preferred over hardcoded
    const contextPosts = [...marketplacePosts, ...rentalPosts, ...swapFeedPosts, ...connectionPosts, ...requestPosts, ...bundlePosts];
    contextPosts.forEach(addPost);

    // Hardcoded posts — lowest priority, skip if context data already covered the same content
    FEED_POSTS.forEach(addPost);

    let all = deduped;
    if (activeFilter !== 'all') all = all.filter((p) => p.type === activeFilter);
    if (tagFilter) all = all.filter((p) => p.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase())));
    // Shuffle on refresh
    if (refreshKey > 0 && activeFilter === 'all' && !tagFilter) {
      all = [...all].sort(() => Math.random() - 0.5);
    }
    return all;
  }, [activeFilter, userPosts, tagFilter, refreshKey, marketplacePosts, rentalPosts, swapFeedPosts, connectionPosts, requestPosts, bundlePosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTagFilter(null);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleSavePost = (postId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
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
    setCelebratedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    router.push(`/event/${event.id}`);
  };

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
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      },
      category: data.category || createCategory || 'General',
      timestamp: 'Just now',
      caption: data.caption,
      media: data.mediaUri,
      mediaWidth: displayWidth,
      mediaHeight: displayHeight,
      tags: createCategory ? [createCategory] : [],
      stats: { saves: 0, comments: 0 },
    };

    // Add to feed
    setUserPosts((prev) => [newPost, ...prev]);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setCreatePreloadMedia(result.assets[0].uri);
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

  const liveCount = FEED_POSTS.filter((p) => p.type === 'live').length;

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
                          {event.date}{event.venue ? ` · ${event.venue}` : ''}
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
