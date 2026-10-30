import {
  Settings,
  Flame,
  DollarSign,
  ChevronRight,
  CalendarDays,
  Edit3,
  Star,
  Briefcase,
  X,
  Camera,
  Bookmark,
  Grid3x3,
  Share2,
  Plus,
  MessageCircle,
  Package,
  Sparkles,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  Modal,
  Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBundles } from '@/contexts/BundleContext';
import { useSkills } from '@/contexts/SkillContext';
import { fetchUserPosts, fetchSavedPosts, type ProfilePost } from '@/lib/profilePosts';
import PostGrid from '@/components/profile/PostGrid';
import PostViewer from '@/components/profile/PostViewer';
import { QRCode } from '@/components/QRCode';
import { profileFollowUrl } from '@/lib/profileLink';
import { useMyPaymentRequests, orderPaymentKey, money as centsMoney } from '@/lib/payments';

const ACCENT = {
  gold: '#FFB800',
  green: '#10B981',
  coral: '#FF6B6B',
  blue: '#3B82F6',
  purple: '#8B5CF6',
};

type Tab = 'posts' | 'saved' | 'activity';

interface Booking {
  id: string;
  title: string;
  price: number;
  pickupTime: string | null;
  status: string;
  bookedAt: string;
  itemId?: string;
  providerId?: string;
}

interface DetailItem {
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  icon?: string;
  grabCount?: number;
  createdAt?: string;
  status?: string;
}

const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

function money(n: number) {
  if (n >= 10000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function statusColor(status: string, fallback: string) {
  switch (status.toLowerCase()) {
    case 'completed': return ACCENT.green;
    case 'in_progress': case 'confirmed': return ACCENT.gold;
    case 'cancelled': return ACCENT.coral;
    default: return fallback;
  }
}

function Empty({ colors, icon, title, text, cta, onCta }: { colors: any; icon: React.ReactNode; title: string; text: string; cta?: string; onCta?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: colors.border }]}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
      {cta ? (
        <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.accent }]} onPress={onCta}>
          <Text style={styles.emptyBtnText}>{cta}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Loading({ colors }: { colors: any }) {
  return <View style={styles.empty}><ActivityIndicator color={colors.textTertiary} /></View>;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { myBundles } = useBundles();
  const { mySkills } = useSkills();

  const [tab, setTab] = useState<Tab>('posts');
  const [refreshing, setRefreshing] = useState(false);

  // Posts / saved
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(false);
  const [saved, setSavedPosts] = useState<ProfilePost[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  // Stats
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // Activity
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  // Viewer + sheets
  const [viewer, setViewer] = useState<{ list: ProfilePost[]; index: number; title: string } | null>(null);
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [followList, setFollowList] = useState<{ title: string; users: any[]; loading: boolean } | null>(null);

  const myId = user?.id;
  const myPayments = useMyPaymentRequests(myId);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    if (!myId) { setPostsLoading(false); return; }
    try {
      setPosts(await fetchUserPosts(myId));
      setPostsError(false);
    } catch {
      setPostsError(true);
    } finally {
      setPostsLoading(false);
    }
  }, [myId]);

  const loadSaved = useCallback(async () => {
    if (!myId) { setSavedLoading(false); return; }
    try { setSavedPosts(await fetchSavedPosts(myId)); } catch { /* keep current */ } finally { setSavedLoading(false); }
  }, [myId]);

  const loadStats = useCallback(async () => {
    if (!myId) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [jobs, recent, reviews, followers, following] = await Promise.all([
      supabase.from('user_grabs').select('price, status').eq('provider_id', myId),
      supabase.from('posts').select('created_at').eq('user_id', myId).gte('created_at', since.toISOString()),
      supabase.from('user_reviews').select('rating').eq('target_user_id', myId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', myId).neq('follower_id', myId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', myId).neq('following_id', myId),
    ]);
    setFollowersCount(followers.count ?? 0);
    setFollowingCount(following.count ?? 0);

    const done = ((jobs.data || []) as any[]).filter((j) => j.status === 'completed');
    setCompleted(done.length);
    setEarnings(done.reduce((sum, j) => sum + Number(j.price || 0), 0));

    // Consecutive posting days ending today (or yesterday), in local time.
    const localDay = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const days = new Set(((recent.data || []) as any[]).map((p) => localDay(new Date(p.created_at))));
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (days.has(localDay(d))) count++;
      else if (i > 0) break;
    }
    setStreak(count);

    const r = (reviews.data || []) as any[];
    setReviewCount(r.length);
    setRating(r.length ? Math.round((r.reduce((s, x) => s + (x.rating || 0), 0) / r.length) * 10) / 10 : 0);
  }, [myId]);

  const loadBookings = useCallback(async () => {
    if (!myId) { setBookingsLoading(false); return; }
    const { data } = await supabase
      .from('user_grabs')
      .select('id, title, price, pickup_time, status, booked_at, item_id, provider_id')
      .eq('user_id', myId)
      .order('booked_at', { ascending: false })
      .limit(30);
    setBookings(((data || []) as any[]).map((g) => ({
      id: g.id,
      title: g.title || 'Plan',
      price: Number(g.price || 0),
      pickupTime: g.pickup_time || null,
      status: g.status || 'pending',
      bookedAt: g.booked_at || '',
      itemId: g.item_id || undefined,
      providerId: g.provider_id || undefined,
    })));
    setBookingsLoading(false);
  }, [myId]);

  useEffect(() => { loadPosts(); loadStats(); loadBookings(); loadSaved(); }, [loadPosts, loadStats, loadBookings, loadSaved]);

  // Saved items change from the feed — refresh whenever the tab regains focus.
  useFocusEffect(useCallback(() => { loadSaved(); loadStats(); }, [loadSaved, loadStats]));

  // Keep the grid live when posts are created/edited/deleted elsewhere.
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`profile-posts-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `user_id=eq.${myId}` }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, loadPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPosts(), loadSaved(), loadStats(), loadBookings()]);
    setRefreshing(false);
  }, [loadPosts, loadSaved, loadStats, loadBookings]);

  const openFollowList = async (type: 'followers' | 'following') => {
    if (!myId) return;
    setFollowList({ title: type === 'followers' ? 'Followers' : 'Following', users: [], loading: true });
    const filterCol = type === 'followers' ? 'following_id' : 'follower_id';
    const joinCol = type === 'followers' ? 'follower_id' : 'following_id';
    const { data: rows } = await supabase.from('follows').select(joinCol).eq(filterCol, myId).neq(joinCol, myId);
    const ids = ((rows || []) as any[]).map((r) => r[joinCol]);
    let users: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', ids);
      users = data || [];
    }
    setFollowList({ title: type === 'followers' ? 'Followers' : 'Following', users, loading: false });
  };

  const shareProfile = () => {
    tap();
    const handle = user?.username ? `@${user.username}` : (user?.fullName || 'me');
    const link = myId ? profileFollowUrl(myId) : '';
    Share.share({ message: link ? `Follow ${handle} on Apparently: ${link}` : `Find ${handle} on Apparently`, ...(link ? { url: link } : {}) }).catch(() => {});
  };

  const openProfile = (id: string) => {
    if (!id || id === myId) return;
    router.push(`/user/${id}` as any);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const name = user?.fullName || user?.username || 'Your name';
  const username = user?.username || '';
  const bio = (user?.bio || '').trim();
  const avatar = user?.avatar || '';
  const offers = useMemo(() => [
    ...mySkills.map((s) => ({ kind: 'Skill' as const, ...s })),
    ...myBundles.map((b) => ({ kind: 'Bundle' as const, ...b })),
  ], [mySkills, myBundles]);

  const highlights = [
    { key: 'earn', label: 'Earned', value: money(earnings), icon: <DollarSign size={16} color={ACCENT.green} />, tint: ACCENT.green },
    { key: 'streak', label: 'Day streak', value: String(streak), icon: <Flame size={16} color={ACCENT.gold} />, tint: ACCENT.gold },
    { key: 'rating', label: reviewCount ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'Rating', value: rating ? rating.toFixed(1) : '—', icon: <Star size={16} color={ACCENT.coral} />, tint: ACCENT.coral },
    { key: 'done', label: 'Completed', value: String(completed), icon: <Briefcase size={16} color={ACCENT.blue} />, tint: ACCENT.blue },
  ];

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderTabContent = () => {
    if (tab === 'posts') {
      if (postsLoading) return <Loading colors={colors} />;
      if (postsError && posts.length === 0) {
        return <Empty colors={colors} icon={<Camera size={26} color={colors.text} />} title="Couldn't load posts" text="Pull down to try again." />;
      }
      if (posts.length === 0) {
        return (
          <Empty
            colors={colors}
            icon={<Camera size={26} color={colors.text} />}
            title="Share your first post"
            text="Photos, videos and thoughts you post will show up here."
            cta="Create a post"
            onCta={() => router.push('/(tabs)/create' as any)}
          />
        );
      }
      return <PostGrid posts={posts} onPostPress={(i) => setViewer({ list: posts, index: i, title: 'Posts' })} />;
    }

    if (tab === 'saved') {
      if (savedLoading) return <Loading colors={colors} />;
      if (saved.length === 0) {
        return <Empty colors={colors} icon={<Bookmark size={26} color={colors.text} />} title="Save posts for later" text="Tap the bookmark on any post. Only you can see what you've saved." />;
      }
      return <PostGrid posts={saved} onPostPress={(i) => setViewer({ list: saved, index: i, title: 'Saved' })} />;
    }

    // Activity: what you offer + what you've booked
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 24 }}>
        <View>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your offers</Text>
            <TouchableOpacity onPress={() => router.push('/skill-builder' as any)} style={styles.sectionLink}>
              <Plus size={15} color={colors.accent} />
              <Text style={[styles.sectionLinkText, { color: colors.accent }]}>New</Text>
            </TouchableOpacity>
          </View>
          {offers.length === 0 ? (
            <View style={[styles.card, styles.cardEmpty, { borderColor: colors.border }]}>
              <Sparkles size={20} color={colors.textTertiary} />
              <Text style={[styles.cardEmptyText, { color: colors.textSecondary }]}>List a skill or bundle so people can book you.</Text>
            </View>
          ) : offers.map((o) => (
            <TouchableOpacity
              key={`${o.kind}-${o.id}`}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setDetail({ title: o.title, description: o.description, price: Number(o.price || 0), category: o.category, imageUrl: o.imageUrl, icon: 'icon' in o ? (o as any).icon : undefined, grabCount: o.grabCount, createdAt: (o as any).createdAt, status: o.status })}
            >
              {o.imageUrl ? (
                <Image source={{ uri: o.imageUrl }} style={styles.cardThumb} />
              ) : (
                <View style={[styles.cardThumb, styles.center, { backgroundColor: ACCENT.purple + '1F' }]}>
                  {'icon' in o && (o as any).icon ? <Text style={{ fontSize: 22 }}>{(o as any).icon}</Text> : <Package size={20} color={ACCENT.purple} />}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{o.title}</Text>
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {o.kind} · {o.category}{o.grabCount ? ` · ${o.grabCount} booked` : ''}
                </Text>
              </View>
              <Text style={[styles.cardPrice, { color: ACCENT.green }]}>${Number(o.price || 0)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Booked</Text>
          </View>
          {bookingsLoading ? <Loading colors={colors} /> : bookings.length === 0 ? (
            <View style={[styles.card, styles.cardEmpty, { borderColor: colors.border }]}>
              <CalendarDays size={20} color={colors.textTertiary} />
              <Text style={[styles.cardEmptyText, { color: colors.textSecondary }]}>Things you book will show up here.</Text>
            </View>
          ) : bookings.map((b) => {
            const sc = statusColor(b.status, colors.textTertiary);
            const pay = b.itemId && b.providerId && myId ? myPayments.byOrder[orderPaymentKey(b.providerId, myId, b.itemId)] : undefined;
            const chat = () => router.push((b.providerId ? `/inbox/conversation/${b.providerId}` : '/inbox') as any);
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setDetail({ title: b.title, description: b.pickupTime ? `Pickup: ${new Date(b.pickupTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : '', price: b.price, category: 'Booking', createdAt: b.bookedAt, status: b.status })}
              >
                <View style={[styles.cardThumb, styles.center, { backgroundColor: sc + '1F' }]}>
                  <CalendarDays size={20} color={sc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{b.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <View style={[styles.chip, { backgroundColor: sc + '1F' }]}>
                      <Text style={[styles.chipText, { color: sc }]}>{b.status.replace('_', ' ')}</Text>
                    </View>
                    {pay?.status === 'paid' ? (
                      <View style={[styles.chip, { backgroundColor: '#10B9811F' }]}><Text style={[styles.chipText, { color: '#10B981' }]}>Paid ✓</Text></View>
                    ) : pay?.status === 'requested' ? (
                      <TouchableOpacity onPress={chat} style={[styles.chip, { backgroundColor: '#F59E0B1F' }]} accessibilityLabel="Pay in chat">
                        <Text style={[styles.chipText, { color: '#F59E0B' }]}>Pay {centsMoney(pay.amount_cents)}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {b.bookedAt ? <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{new Date(b.bookedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text> : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[styles.cardPrice, { color: colors.text }]}>${b.price}</Text>
                  <TouchableOpacity onPress={chat} hitSlop={8} accessibilityLabel="Message about this booking">
                    <MessageCircle size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Screen ─────────────────────────────────────────────────────────────────
  // The cover is a "scan to follow" card: a QR code of this profile's link,
  // with the profile photo overlapping its bottom edge.
  const QR_SIZE = 140;
  const CARD_PAD = 12;
  const CARD_LABEL = 18;
  const AVATAR_OVERLAP = 52; // matches styles.identity marginTop
  const cardHeight = CARD_PAD + CARD_LABEL + QR_SIZE + CARD_PAD + AVATAR_OVERLAP + 8;
  const coverHeight = insets.top + 52 + cardHeight;
  const followUrl = myId ? profileFollowUrl(myId) : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
      >
        {/* ── Header ── */}
        <View>
          <LinearGradient
            colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: coverHeight }}
          >
            <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
              <Text style={styles.topHandle} numberOfLines={1}>{username ? `@${username}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.glassBtn} onPress={() => router.push('/(tabs)/planner' as any)} accessibilityLabel="Planner">
                  <CalendarDays size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassBtn} onPress={() => router.push('/profile/settings' as any)} accessibilityLabel="Settings">
                  <Settings size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
            {followUrl ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setShowQR(true); }}
                style={[styles.qrCard, { height: cardHeight, padding: CARD_PAD, width: QR_SIZE + CARD_PAD * 2, marginLeft: -(QR_SIZE + CARD_PAD * 2) / 2 }]}
                accessibilityLabel="Your scan-to-follow code. Tap to make it bigger or share it."
                testID="profile-qr"
              >
                <Text style={styles.qrLabel}>SCAN TO FOLLOW</Text>
                <QRCode value={followUrl} size={QR_SIZE} />
              </TouchableOpacity>
            ) : null}
          </LinearGradient>

          <View style={styles.identity}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/profile/settings' as any)}
              style={[styles.avatarRing, { backgroundColor: colors.background }]}
              accessibilityLabel="Change profile photo"
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.avatar, styles.center]}>
                  <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              )}
              <View style={[styles.avatarEdit, { borderColor: colors.background, backgroundColor: colors.accent }]}>
                <Camera size={12} color="#FFF" />
              </View>
            </TouchableOpacity>

            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            {bio ? (
              <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text>
            ) : (
              <TouchableOpacity onPress={() => router.push('/profile/settings' as any)}>
                <Text style={[styles.bio, { color: colors.accent, fontWeight: '600' }]}>+ Add a bio</Text>
              </TouchableOpacity>
            )}

            <View style={styles.counts}>
              <View style={styles.count}>
                <Text style={[styles.countValue, { color: colors.text }]}>{posts.length}</Text>
                <Text style={[styles.countLabel, { color: colors.textTertiary }]}>Posts</Text>
              </View>
              <View style={[styles.countDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.count} onPress={() => openFollowList('followers')}>
                <Text style={[styles.countValue, { color: colors.text }]}>{followersCount}</Text>
                <Text style={[styles.countLabel, { color: colors.textTertiary }]}>Followers</Text>
              </TouchableOpacity>
              <View style={[styles.countDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.count} onPress={() => openFollowList('following')}>
                <Text style={[styles.countValue, { color: colors.text }]}>{followingCount}</Text>
                <Text style={[styles.countLabel, { color: colors.textTertiary }]}>Following</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surfaceHighlight }]} onPress={() => router.push('/profile/settings' as any)}>
                <Edit3 size={15} color={colors.text} />
                <Text style={[styles.btnText, { color: colors.text }]}>Edit profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surfaceHighlight }]} onPress={shareProfile}>
                <Share2 size={15} color={colors.text} />
                <Text style={[styles.btnText, { color: colors.text }]}>Share profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
            {highlights.map((h) => (
              <View key={h.key} style={[styles.highlight, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.highlightIcon, { backgroundColor: h.tint + '1F' }]}>{h.icon}</View>
                <View>
                  <Text style={[styles.highlightValue, { color: colors.text }]}>{h.value}</Text>
                  <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>{h.label}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Sticky tab bar ── */}
        <View style={[styles.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {([
            { key: 'posts', icon: Grid3x3, label: 'Posts' },
            { key: 'saved', icon: Bookmark, label: 'Saved' },
            { key: 'activity', icon: Briefcase, label: 'Activity' },
          ] as const).map(({ key, icon: Icon, label }) => {
            const active = tab === key;
            return (
              <TouchableOpacity key={key} style={styles.tab} onPress={() => { tap(); setTab(key); }} accessibilityLabel={label} accessibilityState={{ selected: active }}>
                <Icon size={22} color={active ? colors.text : colors.textTertiary} />
                <View style={[styles.tabIndicator, { backgroundColor: active ? colors.text : 'transparent' }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab content ── */}
        <View style={{ minHeight: 320 }}>{renderTabContent()}</View>
      </ScrollView>

      {/* ── Post viewer ── */}
      <PostViewer
        visible={!!viewer}
        posts={viewer?.list || []}
        initialIndex={viewer?.index || 0}
        title={viewer?.title}
        colors={colors}
        onClose={() => { setViewer(null); loadPosts(); }}
        onOpenProfile={openProfile}
        onDeleted={(id) => {
          setPosts((prev) => prev.filter((p) => p.id !== id));
          setSavedPosts((prev) => prev.filter((p) => p.id !== id));
        }}
        onEdited={(id, caption) => {
          setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
          setSavedPosts((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
        }}
        onSavedChange={() => loadSaved()}
      />

      {/* ── Offer / booking detail ── */}
      <Modal visible={showQR} animationType="fade" transparent onRequestClose={() => setShowQR(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowQR(false)} style={styles.qrBackdrop}>
          <TouchableOpacity activeOpacity={1} style={styles.qrSheet}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.qrSheetAvatar} /> : null}
            <Text style={styles.qrSheetName} numberOfLines={1}>{name}</Text>
            {username ? <Text style={styles.qrSheetHandle}>@{username}</Text> : null}
            {followUrl ? <View style={{ marginTop: 14 }}><QRCode value={followUrl} size={240} /></View> : null}
            <Text style={styles.qrSheetHint}>Scan with any phone camera to open your page and follow you.</Text>
            <View style={styles.qrSheetRow}>
              <TouchableOpacity onPress={shareProfile} style={styles.qrSheetBtn} testID="profile-qr-share">
                <Share2 size={16} color="#FFF" />
                <Text style={styles.qrSheetBtnText}>Share link</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowQR(false)} style={[styles.qrSheetBtn, { backgroundColor: '#EEE' }]}>
                <Text style={[styles.qrSheetBtnText, { color: '#222' }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setDetail(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.sheetGrab, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={2}>{detail?.title}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={8}><X size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {detail?.imageUrl ? <Image source={{ uri: detail.imageUrl }} style={styles.detailImage} /> : null}
              {[
                ['Price', `$${detail?.price ?? 0}`],
                ['Type', detail?.category || '—'],
                detail?.status ? ['Status', detail.status.replace('_', ' ')] : null,
                detail?.grabCount ? ['Booked', String(detail.grabCount)] : null,
                detail?.createdAt ? ['Date', new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })] : null,
              ].filter(Boolean).map((row) => (
                <View key={row![0]} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{row![0]}</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{row![1]}</Text>
                </View>
              ))}
              {detail?.description ? <Text style={[styles.detailDesc, { color: colors.text }]}>{detail.description}</Text> : null}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Followers / following ── */}
      <Modal visible={!!followList} animationType="slide" transparent onRequestClose={() => setFollowList(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setFollowList(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: colors.surface, height: '70%' }]}>
            <View style={[styles.sheetGrab, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{followList?.title}</Text>
              <TouchableOpacity onPress={() => setFollowList(null)} hitSlop={8}><X size={22} color={colors.text} /></TouchableOpacity>
            </View>
            {followList?.loading ? (
              <Loading colors={colors} />
            ) : (
              <FlatList
                data={followList?.users || []}
                keyExtractor={(u: any) => u.id}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', paddingTop: 40 }]}>No one here yet</Text>}
                renderItem={({ item }: any) => (
                  <TouchableOpacity style={styles.personRow} onPress={() => { setFollowList(null); router.push(`/user/${item.id}` as any); }}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={styles.personAvatar} />
                    ) : (
                      <View style={[styles.personAvatar, styles.center, { backgroundColor: colors.surfaceHighlight }]}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{(item.full_name || item.username || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>{item.username || item.full_name || 'User'}</Text>
                      {item.full_name ? <Text style={[styles.personSub, { color: colors.textTertiary }]} numberOfLines={1}>{item.full_name}</Text> : null}
                    </View>
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  topHandle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 12 },
  glassBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  identity: { alignItems: 'center', paddingHorizontal: 24, marginTop: -52 },
  qrCard: { position: 'absolute', bottom: 0, left: '50%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  qrLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: '#7B61FF', height: 18 },
  qrBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrSheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', width: '100%', maxWidth: 340 },
  qrSheetAvatar: { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
  qrSheetName: { fontSize: 18, fontWeight: '800', color: '#111' },
  qrSheetHandle: { fontSize: 14, color: '#666', marginTop: 2 },
  qrSheetHint: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 14, lineHeight: 18 },
  qrSheetRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  qrSheetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7B61FF', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 14 },
  qrSheetBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  avatarRing: { padding: 4, borderRadius: 60 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarInitial: { color: '#FFF', fontSize: 40, fontWeight: '800' },
  avatarEdit: { position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800', marginTop: 10, letterSpacing: -0.3 },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 320 },

  counts: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  count: { alignItems: 'center', minWidth: 84 },
  countValue: { fontSize: 18, fontWeight: '800' },
  countLabel: { fontSize: 12, marginTop: 2 },
  countDivider: { width: StyleSheet.hairlineWidth * 2, height: 26 },

  buttons: { flexDirection: 'row', gap: 8, marginTop: 18, alignSelf: 'stretch' },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 10 },
  btnText: { fontSize: 14, fontWeight: '700' },

  highlights: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16, gap: 10 },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  highlightIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  highlightValue: { fontSize: 15, fontWeight: '800' },
  highlightLabel: { fontSize: 11, marginTop: 1 },

  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: 0 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12 },
  tabIndicator: { height: 2, width: '60%', marginTop: 10, borderRadius: 1 },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sectionLinkText: { fontSize: 14, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  cardEmpty: { borderStyle: 'dashed', borderWidth: 1, paddingVertical: 18 },
  cardEmptyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  cardThumb: { width: 44, height: 44, borderRadius: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 12, marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: '800' },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  sheetGrab: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  sheetTitle: { fontSize: 19, fontWeight: '800', flex: 1 },
  detailImage: { width: '100%', height: 190, borderRadius: 12, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 14, fontWeight: '600' },
  detailValue: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  detailDesc: { fontSize: 15, lineHeight: 22, paddingVertical: 14 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  personAvatar: { width: 44, height: 44, borderRadius: 22 },
  personName: { fontSize: 15, fontWeight: '700' },
  personSub: { fontSize: 13, marginTop: 1 },
});
