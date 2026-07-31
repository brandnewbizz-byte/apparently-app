import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Heart,
  MessageCircle,
  Eye,
  X,
  UserPlus,
  UserCheck,
  Share2,
  Trash2,
  Forward,
  MoreHorizontal,
  MapPin,
  Calendar,
  Link as LinkIcon,
  BadgeCheck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocial } from '@/contexts/SocialContext';

const ACCENT_COLORS = {
  gold: '#FFB800',
  goldDim: 'rgba(255, 184, 0, 0.12)',
  neonGreen: '#10B981',
  neonGreenDim: 'rgba(16, 185, 129, 0.12)',
  coral: '#FF6B6B',
  coralDim: 'rgba(255, 107, 107, 0.12)',
  purple: '#8B5CF6',
  purpleDim: 'rgba(139, 92, 246, 0.12)',
  blue: '#3B82F6',
  blueDim: 'rgba(59, 130, 246, 0.12)',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user: authUser } = useAuth();
  const { deletePost: clearSocialCache } = useSocial();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Profile data
  const [profileUser, setProfileUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [postsCount, setPostsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Posts
  const [allPosts, setAllPosts] = useState<any[]>([]);

  // Viewer
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [viewerPosts, setViewerPosts] = useState<any[]>([]);

  // Follow modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailMode, setDetailMode] = useState<'followers' | 'following'>('followers');
  const [detailUsers, setDetailUsers] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Options modal
  const [showOptions, setShowOptions] = useState(false);

  const displayName = profileUser?.full_name || 'User';
  const displayUsername = profileUser?.username || '';
  const displayAvatar = profileUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop';
  const displayBio = profileUser?.bio || '';
  const isOwnProfile = authUser?.id === userId;

  // ═══════════════════════════════════════
  // Data Fetching
  // ═══════════════════════════════════════

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) setProfileUser(data);
  }, [userId]);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    // Posts count
    const { count: pc } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or('post_kind.is.null,post_kind.neq.reshare');
    setPostsCount(pc ?? 0);

    // Followers
    const { count: fc } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .neq('follower_id', userId);
    setFollowersCount(fc ?? 0);

    // Following
    const { count: fgc } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .neq('following_id', userId);
    setFollowingCount(fgc ?? 0);
  }, [userId]);

  const checkFollowStatus = useCallback(async () => {
    if (!authUser?.id || !userId || authUser.id === userId) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', authUser.id)
      .eq('following_id', userId)
      .single();
    setIsFollowing(!!data);
  }, [authUser?.id, userId]);

  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('posts')
      .select('id, content, image_url, created_at, likes, post_kind')
      .eq('user_id', userId)
      .or('post_kind.is.null,post_kind.neq.reshare')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) {
      setAllPosts(data.map((p: any) => ({
        id: p.id,
        imageUrl: p.image_url,
        caption: p.content,
        likes: p.likes || 0,
        timestamp: p.created_at,
        type: 'photo',
        isOwnPost: false,
      })));
    }
  }, [userId]);

  const fetchFollowUsers = useCallback(async (mode: 'followers' | 'following') => {
    setDetailMode(mode);
    setDetailModal(true);
    setDetailLoading(true);
    if (!userId) { setDetailLoading(false); return; }

    const field = mode === 'followers' ? 'following_id' : 'follower_id';
    const joinField = mode === 'followers' ? 'follower_id' : 'following_id';
    const selfExclude = mode === 'followers'
      ? { field: 'follower_id', val: userId }
      : { field: 'following_id', val: userId };

    const { data, error } = await supabase
      .from('follows')
      .select(`${joinField}, profiles:${joinField}(id, full_name, username, avatar_url)`)
      .eq(field, userId)
      .neq(selfExclude.field, selfExclude.val)
      .limit(50);

    if (!error && data) {
      const users = data
        .map((f: any) => f.profiles)
        .filter(Boolean)
        .filter((u: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === u.id) === i);
      setDetailUsers(users);
    }
    setDetailLoading(false);
  }, [userId]);

  // ═══════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchStats(), fetchPosts(), checkFollowStatus()]);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ═══════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════

  const handleFollow = async () => {
    if (!authUser?.id || !userId || followLoading) return;
    setFollowLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', userId);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: authUser.id, following_id: userId });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
    setFollowLoading(false);
  };

  const handlePostPress = (post: any, posts: any[]) => {
    setSelectedPost(post);
    setViewerPosts(posts);
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('posts').delete().eq('id', postId);
          setAllPosts((prev) => prev.filter((p) => p.id !== postId));
          setPostsCount((c) => Math.max(0, c - 1));
          setSelectedPost(null);
          setViewerPosts([]);
          clearSocialCache(postId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchStats(), fetchPosts(), checkFollowStatus()]);
    setRefreshing(false);
  }, [fetchProfile, fetchStats, fetchPosts, checkFollowStatus]);

  // ═══════════════════════════════════════
  // Grid helpers
  // ═══════════════════════════════════════
  const COL_COUNT = 3;
  const GAP = 2;
  const IMG_SIZE = (SCREEN_WIDTH - GAP * (COL_COUNT - 1)) / COL_COUNT;

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={ACCENT_COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: displayUsername ? `@${displayUsername}` : displayName,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: isDark ? '#1a1a2e' : '#667eea' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_COLORS.gold} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          {/* Profile Header — EXACT same design as profile tab */}
          <View style={styles.profileHeader}>
            <LinearGradient
              colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.headerGradient, { paddingTop: 16 }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, gap: 12 }}>
                {!isOwnProfile && (
                  <>
                    <TouchableOpacity
                      style={[styles.followBtn, { backgroundColor: isFollowing ? 'rgba(255,255,255,0.2)' : '#FFFFFF' }]}
                      onPress={handleFollow}
                      disabled={followLoading}
                    >
                      {isFollowing ? (
                        <UserCheck size={18} color="#FFFFFF" />
                      ) : (
                        <UserPlus size={18} color={isDark ? '#1a1a2e' : '#667eea'} />
                      )}
                      <Text style={[styles.followBtnText, { color: isFollowing ? '#FFFFFF' : isDark ? '#1a1a2e' : '#667eea' }]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.followBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                      onPress={() => router.push(`/inbox/${userId}` as any)}
                    >
                      <MessageCircle size={18} color="#FFFFFF" />
                      <Text style={[styles.followBtnText, { color: '#FFFFFF' }]}>Message</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: displayAvatar }} style={styles.avatar} />
                </View>
                <Text style={styles.userName}>{displayName}</Text>
                {displayUsername ? <Text style={[styles.userBio, { fontWeight: '500' }]}>@{displayUsername}</Text> : null}
                <Text style={styles.userBio}>{displayBio}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Instagram-Style Stats Row — EXACT same as profile tab */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{postsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>posts</Text>
            </View>
            <TouchableOpacity style={styles.statItem} activeOpacity={0.7} onPress={() => fetchFollowUsers('followers')}>
              <Text style={[styles.statValue, { color: colors.text }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} activeOpacity={0.7} onPress={() => fetchFollowUsers('following')}>
              <Text style={[styles.statValue, { color: colors.text }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>following</Text>
            </TouchableOpacity>
          </View>

          {/* Posts Grid — EXACT same as profile tab */}
          <View style={{ paddingHorizontal: 0, paddingTop: 8, paddingBottom: 100 }}>
            {allPosts.length === 0 ? (
              <View style={styles.gridEmpty}>
                <View style={[styles.gridEmptyIcon, { backgroundColor: ACCENT_COLORS.blueDim }]}>
                  <Camera size={28} color={ACCENT_COLORS.blue} />
                </View>
                <Text style={[styles.gridEmptyTitle, { color: colors.text }]}>No posts yet</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {allPosts.map((post, idx) => (
                  <TouchableOpacity
                    key={post.id || idx}
                    activeOpacity={0.8}
                    style={{ width: IMG_SIZE, height: IMG_SIZE, marginRight: (idx % COL_COUNT) < COL_COUNT - 1 ? GAP : 0, marginBottom: GAP }}
                    onPress={() => handlePostPress({ ...post, index: idx }, allPosts)}
                  >
                    <Image
                      source={{ uri: post.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400' }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* ═══════════════════════════════════════
          Post Viewer — EXACT same as profile tab
          ═══════════════════════════════════════ */}
      <Modal visible={!!selectedPost} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setSelectedPost(null); setShowOptions(false); }}>
        <View style={[styles.viewerContainer, { backgroundColor: '#000' }]}>
          {/* Viewer header */}
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => { setSelectedPost(null); setShowOptions(false); }} style={styles.viewerCloseBtn}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowOptions(true)} style={styles.viewerOptionsBtn}>
              <MoreHorizontal size={24} color="#FFFFFF" />
            </TouchableOpacity>
            {isOwnProfile && (
              <TouchableOpacity
                onPress={() => selectedPost && handleDeletePost(selectedPost.id)}
                style={styles.viewerDeleteBtn}
              >
                <Trash2 size={22} color="#FF6B6B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Full-screen image */}
          <View style={styles.viewerImageContainer}>
            {selectedPost?.imageUrl ? (
              <Image
                source={{ uri: selectedPost.imageUrl }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.viewerPlaceholder}>
                <Text style={styles.viewerPlaceholderText}>{selectedPost?.caption || 'No image'}</Text>
              </View>
            )}
          </View>

          {/* Engagement row */}
          <View style={[styles.viewerEngagement, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.engagementLeft}>
              <Heart size={26} color="#FFFFFF" />
              <Text style={styles.engagementCount}>{selectedPost?.likes || 0}</Text>
            </View>
            <Forward size={24} color="#FFFFFF" />
          </View>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={showOptions} animationType="fade" transparent onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
          <View style={[styles.optionsSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.optionsTitle, { color: colors.text }]}>Options</Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  setShowOptions(false);
                  if (selectedPost) handleDeletePost(selectedPost.id);
                }}
              >
                <Trash2 size={20} color={ACCENT_COLORS.coral} />
                <Text style={[styles.optionText, { color: ACCENT_COLORS.coral }]}>Delete Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.optionRow} onPress={() => { setShowOptions(false); }}>
              <Share2 size={20} color={colors.textSecondary} />
              <Text style={[styles.optionText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelRow, { borderTopColor: colors.border }]} onPress={() => setShowOptions(false)}>
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Followers/Following Modal — EXACT same as profile tab */}
      <Modal visible={detailModal} animationType="slide" transparent onRequestClose={() => setDetailModal(false)}>
        <View style={[styles.detailOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.detailSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.detailTitle, { color: colors.text }]}>
                {detailMode === 'followers' ? 'Followers' : 'Following'}
              </Text>
              <View style={{ width: 24 }} />
            </View>
            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="large" color={ACCENT_COLORS.gold} />
              </View>
            ) : (
              <FlatList
                data={detailUsers}
                keyExtractor={(item: any) => item.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }: any) => (
                  <TouchableOpacity
                    style={[styles.detailUserRow, { borderBottomColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDetailModal(false);
                      if (item.id === authUser?.id) {
                        router.push('/(tabs)/profile' as any);
                      } else {
                        router.push(`/user/${item.id}` as any);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: item.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop' }}
                      style={styles.detailAvatar}
                    />
                    <View style={styles.detailUserInfo}>
                      <Text style={[styles.detailUserName, { color: colors.text }]}>{item.full_name || 'User'}</Text>
                      {item.username ? <Text style={[styles.detailUserHandle, { color: colors.textTertiary }]}>@{item.username}</Text> : null}
                    </View>
                    <ChevronRight size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.detailEmpty}>
                    <Text style={[styles.detailEmptyText, { color: colors.textTertiary }]}>No users found</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 0 },
  // Header — exactly matching profile tab
  profileHeader: { marginBottom: 0 },
  headerGradient: { paddingBottom: 28, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  followBtnText: { fontSize: 14, fontWeight: '600' },
  avatarSection: { alignItems: 'center', paddingTop: 4 },
  avatarContainer: { marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF' },
  userName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  userBio: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  // Stats — exactly matching profile tab
  statsRow: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 13, marginTop: 2 },
  // Grid — exactly matching profile tab
  gridEmpty: { alignItems: 'center', paddingVertical: 60 },
  gridEmptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridEmptyTitle: { fontSize: 16, fontWeight: '600' },
  gridImage: { width: '100%', height: '100%', backgroundColor: '#1a1a2e' },
  // Viewer — exactly matching profile tab
  viewerContainer: { flex: 1 },
  viewerHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  viewerCloseBtn: { padding: 8 },
  viewerOptionsBtn: { padding: 8 },
  viewerDeleteBtn: { padding: 8 },
  viewerImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  viewerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  viewerPlaceholderText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  viewerEngagement: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  engagementLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  engagementCount: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  // Options modal
  optionsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  optionsSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20 },
  optionsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  optionText: { fontSize: 16, fontWeight: '500' },
  cancelRow: { paddingVertical: 16, marginTop: 8, borderTopWidth: 0.5, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  // Detail modal — exactly matching profile tab
  detailOverlay: { flex: 1, justifyContent: 'flex-end' },
  detailSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  detailTitle: { fontSize: 17, fontWeight: '700' },
  detailLoading: { paddingVertical: 60 },
  detailUserRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  detailAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  detailUserInfo: { flex: 1 },
  detailUserName: { fontSize: 15, fontWeight: '600' },
  detailUserHandle: { fontSize: 13, marginTop: 2 },
  detailEmpty: { paddingVertical: 40, alignItems: 'center' },
  detailEmptyText: { fontSize: 15 },
});
