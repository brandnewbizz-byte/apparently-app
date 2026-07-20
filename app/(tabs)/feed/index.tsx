import {
  Calendar, Clock, MapPin, Users, Sparkles, Dumbbell, Utensils, Palette,
  Plane, Heart, Music, Zap, Filter, Play, Plus, Eye,
  ArrowRight, MessageCircle, CheckCircle2, Star, ShoppingBag, Wrench, Bookmark,
  Radio, TrendingUp,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTabBar } from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────

type ActivityType = 'plan' | 'event' | 'creation' | 'achievement' | 'deal' | 'live';

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  creator: { name: string; avatar: string };
  category: string;
  timestamp: string;
  date?: string;
  location?: string;
  attendees?: number;
  maxAttendees?: number;
  price?: number;
  image?: string;
  tags: string[];
  stats: { saves: number; comments: number };
  viewerCount?: number;
  streamDuration?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  Wellness: { icon: Heart, color: '#EC4899', bg: '#EC489915' },
  Fitness: { icon: Dumbbell, color: '#F97316', bg: '#F9731615' },
  Entertainment: { icon: Music, color: '#8B5CF6', bg: '#8B5CF615' },
  Creative: { icon: Palette, color: '#06B6D4', bg: '#06B6D415' },
  Dining: { icon: Utensils, color: '#EF4444', bg: '#EF444415' },
  Travel: { icon: Plane, color: '#10B981', bg: '#10B98115' },
  Business: { icon: TrendingUp, color: '#3B82F6', bg: '#3B82F615' },
  Shopping: { icon: ShoppingBag, color: '#F59E0B', bg: '#F59E0B15' },
  Services: { icon: Wrench, color: '#6366F1', bg: '#6366F115' },
};

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const ACTIVITY_DATA: ActivityItem[] = [
  // ── LIVE STREAMS ──
  {
    id: 'live-1', type: 'live', title: 'Sunday Jazz & Lo-Fi Session 🎷',
    description: 'Live from Brooklyn. Chilled beats, good vibes, taking requests.',
    creator: { name: 'Marcus Beats', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    category: 'Entertainment', timestamp: 'Live now',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
    viewerCount: 1247, streamDuration: '42m streaming',
    tags: ['Jazz', 'Lo-Fi', 'Live'], stats: { saves: 56, comments: 89 },
  },
  {
    id: 'live-2', type: 'live', title: 'Morning Yoga Flow — All Levels 🧘',
    description: 'Join live for a guided flow. Modifications shown for every pose.',
    creator: { name: 'Lena Wellness', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    category: 'Wellness', timestamp: 'Live now',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600',
    viewerCount: 892, streamDuration: '18m streaming',
    tags: ['Yoga', 'Morning', 'Wellness'], stats: { saves: 112, comments: 34 },
  },
  {
    id: 'live-3', type: 'live', title: 'NYC Night Photography Walk 📸',
    description: 'Exploring Times Square at night — gear talk and shooting tips.',
    creator: { name: 'Lisa Captures', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    category: 'Creative', timestamp: 'Live now',
    image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600',
    viewerCount: 456, streamDuration: '1h 5m streaming',
    tags: ['Photography', 'NYC', 'Night'], stats: { saves: 34, comments: 18 },
  },

  // ── PLANS ──
  {
    id: 'plan-1', type: 'plan', title: 'Sunrise Yoga in Central Park',
    description: 'Join our morning flow. All levels welcome — bring your own mat.',
    creator: { name: 'Lena Wellness', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    category: 'Wellness', timestamp: '2h ago',
    date: 'Tomorrow · 6:30 AM', location: 'Central Park, NYC', attendees: 12, maxAttendees: 20,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
    tags: ['Yoga', 'Outdoors', 'Morning'], stats: { saves: 28, comments: 7 },
  },
  {
    id: 'plan-2', type: 'plan', title: 'Weekend Brunch Crawl — East Village',
    description: 'Hit 4 spots in one afternoon. Fixed-price menu at each stop.',
    creator: { name: 'Chef Tony', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
    category: 'Dining', timestamp: '5h ago',
    date: 'Sat · 11:00 AM', location: 'East Village, NYC', attendees: 8, maxAttendees: 15,
    tags: ['Brunch', 'Food Tour', 'Weekend'], stats: { saves: 45, comments: 12 },
  },
  {
    id: 'plan-3', type: 'plan', title: 'Sunset Photography Walk',
    description: 'Capture golden hour at Brooklyn Bridge. Bring any camera.',
    creator: { name: 'Lisa Captures', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    category: 'Creative', timestamp: '8h ago',
    date: 'Sun · 6:00 PM', location: 'Brooklyn Bridge', attendees: 5, maxAttendees: 12,
    tags: ['Photography', 'Sunset', 'Brooklyn'], stats: { saves: 19, comments: 4 },
  },

  // ── EVENTS ──
  {
    id: 'event-1', type: 'event', title: 'Summer Beats Rooftop Session 🎧',
    description: 'Live DJ set with skyline views. Drinks included with ticket.',
    creator: { name: 'DJ Aria', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    category: 'Entertainment', timestamp: '3h ago',
    date: 'Fri · 8:00 PM', location: 'SoHo Rooftop', attendees: 45, maxAttendees: 60,
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
    price: 25, tags: ['DJ', 'Rooftop', 'Music'], stats: { saves: 67, comments: 23 },
  },
  {
    id: 'event-2', type: 'event', title: 'HIIT Bootcamp — 45 Min Blast',
    description: 'High intensity interval training. Modifications for all levels.',
    creator: { name: 'Fit With Zoe', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
    category: 'Fitness', timestamp: '6h ago',
    date: 'Daily · 7:00 AM', location: 'Hudson Yards', attendees: 18, maxAttendees: 25,
    tags: ['HIIT', 'Bootcamp', 'Morning'], stats: { saves: 34, comments: 9 },
  },

  // ── CREATIONS ──
  {
    id: 'create-1', type: 'creation', title: 'Handmade Ceramic Mug Set',
    description: 'Wheel-thrown stoneware, glazed in ocean blue. Set of 4.',
    creator: { name: 'Crafty Kate', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
    category: 'Creative', timestamp: '1h ago',
    image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400',
    price: 45, tags: ['Ceramics', 'Handmade', 'Home'], stats: { saves: 52, comments: 15 },
  },
  {
    id: 'create-2', type: 'creation', title: 'Meal Prep Guide — 5 Days',
    description: 'Complete grocery list + recipes. High protein, under 30 min prep.',
    creator: { name: 'Chef Tony', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
    category: 'Dining', timestamp: '4h ago',
    price: 12, tags: ['Meal Prep', 'Guide', 'Healthy'], stats: { saves: 89, comments: 20 },
  },

  // ── ACHIEVEMENTS ──
  {
    id: 'achieve-1', type: 'achievement', title: 'Completed 30-Day Yoga Streak 🧘',
    description: 'Never missed a day. Feeling stronger, calmer, and more flexible.',
    creator: { name: 'Marcus Beats', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    category: 'Wellness', timestamp: '2h ago',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400',
    tags: ['Yoga', 'Streak', 'Milestone'], stats: { saves: 0, comments: 31 },
  },
  {
    id: 'achieve-2', type: 'achievement', title: 'Ran First Half Marathon 🏃',
    description: '1:52 finish. Brooklyn Half — the crowd energy was unreal.',
    creator: { name: 'Fit With Zoe', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
    category: 'Fitness', timestamp: '12h ago',
    tags: ['Running', 'Half Marathon', 'Personal Best'], stats: { saves: 0, comments: 47 },
  },

  // ── DEALS ──
  {
    id: 'deal-1', type: 'deal', title: 'Personal Training — 5 Session Pack',
    description: 'Custom program design + 1-on-1 coaching. In-person or virtual.',
    creator: { name: 'Coach Ray', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100' },
    category: 'Fitness', timestamp: '30m ago',
    price: 199, tags: ['Training', 'Coaching', 'Fitness'], stats: { saves: 23, comments: 6 },
  },
  {
    id: 'deal-2', type: 'deal', title: 'Logo Design + Brand Kit',
    description: 'Custom logo, color palette, typography guide. 3 revision rounds.',
    creator: { name: 'Lisa Captures', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
    category: 'Creative', timestamp: '7h ago',
    price: 150, tags: ['Design', 'Branding', 'Logo'], stats: { saves: 41, comments: 8 },
  },
];

// ── Filter options ──
const FILTERS = [
  { key: 'all', label: 'All', icon: Zap },
  { key: 'live', label: 'Live', icon: Radio },
  { key: 'plan', label: 'Plans', icon: Calendar },
  { key: 'event', label: 'Events', icon: Sparkles },
  { key: 'creation', label: 'Creations', icon: Palette },
  { key: 'deal', label: 'Deals', icon: ShoppingBag },
];

// ── Format helpers ──
function formatPrice(n: number): string {
  if (n === 0) return 'Free';
  return `$${n}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Activity Card Component
// ═══════════════════════════════════════════════════════════════════════════

function ActivityCard({
  item,
  colors,
  onPress,
}: {
  item: ActivityItem;
  colors: any;
  onPress: () => void;
}) {
  const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.Wellness;
  const CatIcon = cat.icon;
  const [saved, setSaved] = useState(false);

  const typeBadge = (() => {
    switch (item.type) {
      case 'live': return { label: 'LIVE', Icon: Radio, bg: '#EF444415', fg: '#EF4444' };
      case 'plan': return { label: 'Plan', Icon: Calendar, bg: '#3B82F615', fg: '#3B82F6' };
      case 'event': return { label: 'Event', Icon: Sparkles, bg: '#8B5CF615', fg: '#8B5CF6' };
      case 'creation': return { label: 'Creation', Icon: Star, bg: '#F59E0B15', fg: '#F59E0B' };
      case 'achievement': return { label: 'Achievement', Icon: CheckCircle2, bg: '#10B98115', fg: '#10B981' };
      case 'deal': return { label: 'Deal', Icon: ShoppingBag, bg: '#EC489915', fg: '#EC4899' };
    }
  })();
  const BadgeIcon = typeBadge.Icon;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.95}
      onPress={onPress}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Image source={{ uri: item.creator.avatar }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.cardCreator, { color: colors.textSecondary }]}>
              {item.creator.name} · {item.timestamp}
            </Text>
          </View>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: typeBadge.bg }]}>
          {item.type === 'live' && <View style={styles.liveDot} />}
          <BadgeIcon size={10} color={typeBadge.fg} />
          <Text style={[styles.typeBadgeText, { color: typeBadge.fg }]}>{typeBadge.label}</Text>
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
        {item.description}
      </Text>

      {/* Image (if present) — live streams get taller image */}
      {item.image && (
        <View style={item.type === 'live' ? styles.liveImageWrap : undefined}>
          <Image source={{ uri: item.image }} style={item.type === 'live' ? styles.liveImage : styles.cardImage} />
          {item.type === 'live' && (
            <View style={styles.liveOverlay}>
              <View style={styles.liveBadgePill}>
                <View style={styles.liveDotWhite} />
                <Text style={styles.liveBadgeLabel}>LIVE</Text>
              </View>
              <View style={styles.liveViewerPill}>
                <Eye size={11} color="#FFF" />
                <Text style={styles.liveViewerText}>{formatViewers(item.viewerCount || 0)} watching</Text>
              </View>
              <View style={styles.liveDuration}>
                <Text style={styles.liveDurationText}>{item.streamDuration}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={[styles.metaChip, { backgroundColor: cat.bg }]}>
          <CatIcon size={11} color={cat.color} />
          <Text style={[styles.metaChipText, { color: cat.color }]}>{item.category}</Text>
        </View>

        {item.date && (
          <View style={[styles.metaChip, { backgroundColor: colors.background }]}>
            <Clock size={11} color={colors.textTertiary} />
            <Text style={[styles.metaChipText, { color: colors.textTertiary }]}>{item.date}</Text>
          </View>
        )}

        {item.location && (
          <View style={[styles.metaChip, { backgroundColor: colors.background }]}>
            <MapPin size={11} color={colors.textTertiary} />
            <Text style={[styles.metaChipText, { color: colors.textTertiary }]} numberOfLines={1}>{item.location}</Text>
          </View>
        )}

        {item.attendees != null && (
          <View style={[styles.metaChip, { backgroundColor: colors.background }]}>
            <Users size={11} color={colors.textTertiary} />
            <Text style={[styles.metaChipText, { color: colors.textTertiary }]}>
              {item.attendees}/{item.maxAttendees}
            </Text>
          </View>
        )}
      </View>

      {/* Tags */}
      {item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.accent + '10' }]}>
              <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action row — NO GRABS on feed */}
      <View style={styles.actionRow}>
        {item.price != null ? (
          <Text style={[styles.priceText, { color: colors.accent }]}>{formatPrice(item.price)}</Text>
        ) : item.type === 'achievement' ? (
          <View style={styles.actionHint}>
            <CheckCircle2 size={14} color="#10B981" />
            <Text style={[styles.actionHintText, { color: '#10B981' }]}>Completed!</Text>
          </View>
        ) : item.type === 'live' ? (
          <View style={styles.actionHint}>
            <Play size={14} color="#EF4444" />
            <Text style={[styles.actionHintText, { color: '#EF4444' }]}>Watch now</Text>
          </View>
        ) : (
          <View />
        )}

        <View style={styles.actionBtns}>
          {/* All content types: Save + Comment */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.background }]}
            onPress={() => { setSaved(!saved); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Bookmark size={15} color={saved ? colors.accent : colors.textTertiary} fill={saved ? colors.accent : 'none'} />
            <Text style={[styles.actionCount, { color: colors.textTertiary }]}>{item.stats.saves + (saved ? 1 : 0)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background }]}>
            <MessageCircle size={15} color={colors.textTertiary} />
            <Text style={[styles.actionCount, { color: colors.textTertiary }]}>{item.stats.comments}</Text>
          </TouchableOpacity>

          {/* Achievement: extra celebrate */}
          {item.type === 'achievement' && (
            <TouchableOpacity style={[styles.celebrateBtn, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
              <Sparkles size={13} color="#10B981" />
              <Text style={[styles.celebrateBtnText, { color: '#10B981' }]}>👏</Text>
            </TouchableOpacity>
          )}

          {/* Live: watch button */}
          {item.type === 'live' && (
            <TouchableOpacity style={[styles.grabBtn, { backgroundColor: '#EF4444' }]}>
              <Play size={14} color="#FFF" fill="#FFF" />
              <Text style={styles.grabBtnText}>Join</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Feed Screen
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredData = useMemo(() => {
    if (activeFilter === 'all') return ACTIVITY_DATA;
    return ACTIVITY_DATA.filter((item) => item.type === activeFilter);
  }, [activeFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const liveCount = ACTIVITY_DATA.filter((i) => i.type === 'live').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Activity</Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              {filteredData.length} posts{activeFilter === 'all' && liveCount > 0 ? ` · ${liveCount} live` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
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

      {/* Feed List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityCard
            item={item}
            colors={colors}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Calendar size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
              No {activeFilter === 'all' ? 'activity' : activeFilter + 's'} to show right now.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Header
  header: { paddingHorizontal: 16, paddingBottom: 4, borderBottomWidth: 1 },
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
  // Activity Card
  card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardCreator: { fontSize: 12, marginTop: 1 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' },
  cardDesc: { fontSize: 13, lineHeight: 19 },
  cardImage: { width: '100%', height: 180, borderRadius: 10, marginTop: 2 },
  // Live image
  liveImageWrap: { position: 'relative', marginTop: 2 },
  liveImage: { width: '100%', height: 220, borderRadius: 10 },
  liveOverlay: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  liveBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  liveDotWhite: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  liveBadgeLabel: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  liveViewerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  liveViewerText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  liveDuration: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  liveDurationText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  // Meta
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaChipText: { fontSize: 11, fontWeight: '600' },
  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },
  // Action row
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceText: { fontSize: 18, fontWeight: '800' },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionHintText: { fontSize: 13, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionCount: { fontSize: 12, fontWeight: '600' },
  grabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  grabBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  celebrateBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  celebrateBtnText: { fontSize: 13, fontWeight: '700' },
  // List
  listContent: { paddingBottom: 100 },
  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
