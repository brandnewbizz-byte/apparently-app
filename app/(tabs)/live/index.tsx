import {
  Play, Radio, Users, Clock, Eye, Flame, Zap, Calendar, ChevronRight, MapPin, Sparkles,
} from 'lucide-react-native';
import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

interface Stream {
  id: string;
  title: string;
  streamerName: string;
  streamerAvatar: string;
  thumbnail: string;
  viewers: number;
  category: string;
  tags: string[];
  isLive: boolean;
  scheduledFor?: string;
  duration?: string;
  description?: string;
}

const LIVE_STREAMS: Stream[] = [
  {
    id: 'live-1', title: 'Sunday Jazz & Lo-Fi Session 🎷',
    streamerName: 'Marcus Beats', streamerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
    viewers: 1247, category: 'Music', tags: ['Jazz', 'Lo-Fi', 'Live'],
    isLive: true,
  },
  {
    id: 'live-2', title: 'Morning Yoga Flow — All Levels 🧘',
    streamerName: 'Lena Wellness', streamerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600',
    viewers: 892, category: 'Wellness', tags: ['Yoga', 'Morning', 'Wellness'],
    isLive: true,
  },
  {
    id: 'live-3', title: 'Cooking Pasta From Scratch 🍝',
    streamerName: 'Chef Tony', streamerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600',
    viewers: 2103, category: 'Food', tags: ['Cooking', 'Italian', 'Live'],
    isLive: true,
  },
  {
    id: 'live-4', title: 'NYC Night Photography Walk 📸',
    streamerName: 'Lisa Captures', streamerAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600',
    viewers: 456, category: 'Creative', tags: ['Photography', 'NYC', 'Night'],
    isLive: true,
  },
];

const UPCOMING_SHOWS: Stream[] = [
  {
    id: 'up-1', title: 'DJ Set: Deep House Sundown 🌅',
    streamerName: 'DJ Aria', streamerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
    viewers: 0, category: 'Music', tags: ['DJ', 'House', 'Sunset'],
    isLive: false, scheduledFor: '8:00 PM EST',
    description: '2-hour deep house set as the sun goes down.',
  },
  {
    id: 'up-2', title: 'Monday Motivation & Goal Setting 🎯',
    streamerName: 'Coach Ray', streamerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400',
    viewers: 0, category: 'Wellness', tags: ['Motivation', 'Goals', 'Coaching'],
    isLive: false, scheduledFor: 'Tomorrow 7:00 AM',
    description: 'Start your week right with goal setting and accountability.',
  },
  {
    id: 'up-3', title: 'DIY Home Decor Workshop 🏠',
    streamerName: 'Crafty Kate', streamerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400',
    viewers: 0, category: 'Creative', tags: ['DIY', 'Home', 'Crafts'],
    isLive: false, scheduledFor: 'Wed 6:00 PM',
  },
];

const PAST_BROADCASTS: Stream[] = [
  {
    id: 'past-1', title: 'Saturday Comedy Open Mic Night 🎤',
    streamerName: 'Laugh Factory', streamerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400',
    viewers: 4300, category: 'Entertainment', tags: ['Comedy', 'Stand-up'],
    isLive: false, duration: '1h 24m',
  },
  {
    id: 'past-2', title: 'HIIT Cardio Blast — 30 Min 🔥',
    streamerName: 'Fit With Zoe', streamerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=400',
    viewers: 8200, category: 'Fitness', tags: ['HIIT', 'Cardio', 'Workout'],
    isLive: false, duration: '32m',
  },
  {
    id: 'past-3', title: 'Tokyo Food Tour — Hidden Gems 🍜',
    streamerName: 'Eat With Kenji', streamerAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1e?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
    viewers: 12000, category: 'Food', tags: ['Tokyo', 'Food Tour', 'Travel'],
    isLive: false, duration: '52m',
  },
  {
    id: 'past-4', title: 'Guitar Masterclass: Blues Basics 🎸',
    streamerName: 'Marcus Beats', streamerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=400',
    viewers: 6100, category: 'Music', tags: ['Guitar', 'Blues', 'Tutorial'],
    isLive: false, duration: '1h 5m',
  },
  {
    id: 'past-5', title: 'Meditation & Breathwork Session 🌿',
    streamerName: 'Lena Wellness', streamerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400',
    viewers: 3700, category: 'Wellness', tags: ['Meditation', 'Breathwork'],
    isLive: false, duration: '24m',
  },
  {
    id: 'past-6', title: 'Startup Pitch Review — Live Feedback 💼',
    streamerName: 'Venture Voice', streamerAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100',
    thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400',
    viewers: 2800, category: 'Business', tags: ['Startups', 'Pitch', 'Business'],
    isLive: false, duration: '1h 12m',
  },
];

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const renderLiveBadge = () => (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveBadgeText}>LIVE</Text>
    </View>
  );

  const renderViewerCount = (count: number) => (
    <View style={styles.viewerRow}>
      <Eye size={11} color="#FFF" />
      <Text style={styles.viewerText}>{formatViewers(count)} watching</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Radio size={22} color="#FFF" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Apparently Live</Text>
              <Text style={[styles.headerSub, { color: colors.textTertiary }]}>{LIVE_STREAMS.length} streaming now</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.goLiveBtn, { backgroundColor: '#EF4444' }]}>
            <Zap size={14} color="#FFF" />
            <Text style={styles.goLiveText}>Go Live</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ========== FEATURED STREAM ========== */}
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabel}>
                <Flame size={16} color="#EF4444" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured</Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.95}>
              <ImageBackground
                source={{ uri: LIVE_STREAMS[0].thumbnail }}
                style={styles.featuredCard}
                imageStyle={styles.featuredImage}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  style={styles.featuredOverlay}
                >
                  <View style={styles.featuredTop}>
                    {renderLiveBadge()}
                    {renderViewerCount(LIVE_STREAMS[0].viewers)}
                  </View>
                  <View style={styles.featuredBottom}>
                    <Text style={styles.featuredTitle}>{LIVE_STREAMS[0].title}</Text>
                    <View style={styles.featuredMeta}>
                      <Image source={{ uri: LIVE_STREAMS[0].streamerAvatar }} style={styles.streamerAvatar} />
                      <Text style={styles.streamerName}>{LIVE_STREAMS[0].streamerName}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          </View>

          {/* ========== LIVE NOW ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabel}>
                <View style={styles.pulsingDot} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Live Now</Text>
              </View>
              <TouchableOpacity style={styles.seeAll}>
                <Text style={[styles.seeAllText, { color: colors.accent }]}>See all</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveScroll}>
              {LIVE_STREAMS.slice(1).map((stream) => (
                <TouchableOpacity key={stream.id} style={[styles.liveCard, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.9}>
                  <ImageBackground source={{ uri: stream.thumbnail }} style={styles.liveThumb} imageStyle={styles.liveThumbImg}>
                    <View style={styles.liveCardTop}>
                      {renderLiveBadge()}
                    </View>
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.liveCardGradient}>
                      {renderViewerCount(stream.viewers)}
                    </LinearGradient>
                  </ImageBackground>
                  <View style={styles.liveCardBody}>
                    <Text style={[styles.liveCardTitle, { color: colors.text }]} numberOfLines={2}>{stream.title}</Text>
                    <View style={styles.liveCardMeta}>
                      <Image source={{ uri: stream.streamerAvatar }} style={styles.miniAvatar} />
                      <Text style={[styles.liveCardStreamer, { color: colors.textSecondary }]}>{stream.streamerName}</Text>
                    </View>
                    <View style={styles.tagRow}>
                      {stream.tags.slice(0, 2).map((tag) => (
                        <View key={tag} style={[styles.tag, { backgroundColor: colors.accent + '18' }]}>
                          <Text style={[styles.tagText, { color: colors.accent }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ========== UPCOMING SHOWS ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabel}>
                <Calendar size={16} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming</Text>
              </View>
            </View>
            {UPCOMING_SHOWS.map((show) => (
              <TouchableOpacity key={show.id} style={[styles.upcomingCard, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.9}>
                <Image source={{ uri: show.thumbnail }} style={styles.upcomingThumb} />
                <View style={styles.upcomingBody}>
                  <Text style={[styles.upcomingTitle, { color: colors.text }]} numberOfLines={2}>{show.title}</Text>
                  <View style={styles.upcomingMeta}>
                    <Image source={{ uri: show.streamerAvatar }} style={styles.miniAvatar} />
                    <Text style={[styles.upcomingStreamer, { color: colors.textSecondary }]}>{show.streamerName}</Text>
                  </View>
                  {show.description && (
                    <Text style={[styles.upcomingDesc, { color: colors.textTertiary }]} numberOfLines={1}>{show.description}</Text>
                  )}
                </View>
                <View style={styles.upcomingTime}>
                  <Clock size={12} color="#8B5CF6" />
                  <Text style={styles.upcomingTimeText}>{show.scheduledFor}</Text>
                  <TouchableOpacity style={styles.remindBtn}>
                    <Sparkles size={12} color="#8B5CF6" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ========== PAST BROADCASTS ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabel}>
                <Play size={16} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Past Broadcasts</Text>
              </View>
              <TouchableOpacity style={styles.seeAll}>
                <Text style={[styles.seeAllText, { color: colors.accent }]}>See all</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View style={styles.pastGrid}>
              {PAST_BROADCASTS.map((vod) => (
                <TouchableOpacity key={vod.id} style={[styles.pastCard, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.9}>
                  <ImageBackground source={{ uri: vod.thumbnail }} style={styles.pastThumb} imageStyle={styles.pastThumbImg}>
                    <View style={styles.pastDuration}>
                      <Play size={10} color="#FFF" fill="#FFF" />
                      <Text style={styles.pastDurationText}>{vod.duration}</Text>
                    </View>
                  </ImageBackground>
                  <View style={styles.pastBody}>
                    <Text style={[styles.pastTitle, { color: colors.text }]} numberOfLines={2}>{vod.title}</Text>
                    <View style={styles.pastMeta}>
                      <Image source={{ uri: vod.streamerAvatar }} style={styles.miniAvatar} />
                      <Text style={[styles.pastStreamer, { color: colors.textSecondary }]}>{vod.streamerName}</Text>
                    </View>
                    <View style={styles.pastStats}>
                      <Eye size={11} color={colors.textTertiary} />
                      <Text style={[styles.pastViewCount, { color: colors.textTertiary }]}>{formatViewers(vod.viewers)} views</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  goLiveText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  // Featured
  featuredSection: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: '600' },
  featuredCard: { height: 240, borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
  featuredImage: { borderRadius: 16 },
  featuredOverlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between' },
  featuredBottom: { gap: 8 },
  featuredTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streamerAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFF' },
  streamerName: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  viewerText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  // Live Now
  section: { paddingHorizontal: 16, paddingTop: 24 },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveScroll: { gap: 12, paddingRight: 16 },
  liveCard: { width: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  liveThumb: { height: 120, justifyContent: 'space-between' },
  liveThumbImg: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  liveCardTop: { padding: 8 },
  liveCardGradient: { padding: 8, alignItems: 'flex-end' },
  liveCardBody: { padding: 10, gap: 4 },
  liveCardTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  liveCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniAvatar: { width: 18, height: 18, borderRadius: 9 },
  liveCardStreamer: { fontSize: 12 },
  tagRow: { flexDirection: 'row', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: '600' },
  // Upcoming
  upcomingCard: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10, gap: 10 },
  upcomingThumb: { width: 80, height: 80, borderRadius: 10 },
  upcomingBody: { flex: 1, gap: 4, justifyContent: 'center' },
  upcomingTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  upcomingMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  upcomingStreamer: { fontSize: 12 },
  upcomingDesc: { fontSize: 11, lineHeight: 15 },
  upcomingTime: { alignItems: 'center', gap: 4, justifyContent: 'center' },
  upcomingTimeText: { fontSize: 11, fontWeight: '700', color: '#8B5CF6' },
  remindBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#8B5CF618', alignItems: 'center', justifyContent: 'center' },
  // Past Broadcasts
  pastGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pastCard: { width: (SCREEN_WIDTH - 42) / 2, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  pastThumb: { height: 100 },
  pastThumbImg: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  pastDuration: { position: 'absolute', bottom: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pastDurationText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  pastBody: { padding: 10, gap: 4 },
  pastTitle: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  pastMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pastStreamer: { fontSize: 11 },
  pastStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  pastViewCount: { fontSize: 11 },
});
