import {
  Flame,
  MapPin,
  ChevronRight,
  Calendar,
  Package,
  Eye,
  MessageSquare,
  ShoppingBag,
  Edit3,
  Star,
  TrendingUp,
  Award,
  User as UserIcon,
  Briefcase,
  Heart,
  X,
  Zap,
  Camera,
  Bookmark,
  Send,
  Trash2,
  Forward,
  Plus,
  MoreHorizontal,
  Settings,
  UserPlus,
  UserMinus,
  MessageCircle,
  Grid3X3,
  ImageIcon,
} from 'lucide-react-native';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

const screenWidth = Dimensions.get('window').width;

// ═══════════════════════════════════════════════════════════════════════════
// User Posts Grid — Instagram 3-column grid
// ═══════════════════════════════════════════════════════════════════════════

function UserPostsGrid({
  posts,
  onPostPress,
}: {
  posts: any[];
  onPostPress?: (post: any, posts: any[]) => void;
}) {
  const size = (screenWidth - 4) / 3;

  if (!posts || posts.length === 0) {
    return (
      <View style={profileStyles.gridEmpty}>
        <View style={[profileStyles.gridEmptyIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
          <Camera size={24} color="#999" />
        </View>
        <Text style={[profileStyles.gridEmptyTitle, { color: '#FFF' }]}>No Posts Yet</Text>
        <Text style={[profileStyles.gridEmptyText, { color: 'rgba(255,255,255,0.5)' }]}>
          Posts will appear here once they&apos;re created.
        </Text>
      </View>
    );
  }

  return (
    <View style={profileStyles.grid}>
      {posts.map((post: any, index: number) => {
        const imageUrl = post.image_url || '';
        return (
          <TouchableOpacity
            key={post.id || `post-${index}`}
            style={{ width: size, height: size, margin: 1 }}
            activeOpacity={0.8}
            onPress={() => onPostPress?.(post, posts)}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#222',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={24} color="#555" />
              </View>
            )}
            {(post.likes > 0 || post.comments > 0) && (
              <View style={profileStyles.gridOverlay}>
                <Heart size={10} color="#FFF" fill="#FFF" />
                <Text style={profileStyles.gridOverlayText}>{post.likes || 0}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Instagram Post Viewer
// ═══════════════════════════════════════════════════════════════════════════

function InstagramPostViewer({
  visible,
  post,
  allPosts,
  onClose,
  onNavigate,
  onDelete,
  onReshare,
}: {
  visible: boolean;
  post: any;
  allPosts: any[];
  onClose: () => void;
  onNavigate?: (post: any) => void;
  onDelete?: () => void;
  onReshare?: () => void;
}) {
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(80)).current;

  const postsList = useMemo(() => {
    const idx = allPosts.findIndex((p: any) => p.id === post?.id);
    return idx >= 0 ? allPosts : post ? [post] : [];
  }, [allPosts, post]);
  const safePosts = postsList.length > 0 ? postsList : post ? [post] : [];
  const currentPost = safePosts[activeIndex] || post;
  const authorName = currentPost?.profiles?.full_name || currentPost?.authorName || 'User';
  const caption = currentPost?.content || '';
  const timestamp = currentPost?.created_at || currentPost?.timestamp || '';
  const isTextOnly = !currentPost?.image_url && !currentPost?.media_url;

  // Animate in / out
  useEffect(() => {
    if (visible) {
      setActiveIndex(postsList.findIndex((p: any) => p.id === post?.id) || 0);
      setLiked(false);
      setLikeCount(post?.likes || 0);
      setCommentText('');
      setComments([]);
      setShowComments(true);
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 80, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, post?.id]);

  // Fetch comments
  useEffect(() => {
    if (!visible || !currentPost?.id) return;
    let cancelled = false;
    const loadComments = async () => {
      try {
        const { data } = await supabase
          .from('comments')
          .select('id, content, created_at, author_id, profiles(full_name, username)')
          .eq('post_id', currentPost.id)
          .order('created_at', { ascending: true })
          .limit(50);
        if (!cancelled && data) setComments(data);
      } catch {}
    };
    loadComments();
    return () => { cancelled = true; };
  }, [visible, currentPost?.id]);

  const toggleLikeLocal = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (liked) {
      setLiked(false);
      setLikeCount((p: number) => Math.max(0, p - 1));
    } else {
      setLiked(true);
      setLikeCount((p: number) => p + 1);
    }
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text || !currentPost?.id) return;
    setCommenting(true);
    const temp = { id: `temp-${Date.now()}`, content: text, author_id: 'me', profiles: { full_name: 'You', username: 'you' } };
    setComments((prev: any[]) => [...prev, temp]);
    setCommentText('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('comments').insert({
          post_id: currentPost.id,
          author_id: user.id,
          content: text,
        });
      }
    } catch (e) {
      console.log('[Viewer] comment insert error:', e);
    } finally {
      setCommenting(false);
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 80, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleMomentumScrollEnd = useCallback(
    (e: any) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      if (idx !== activeIndex) {
        setActiveIndex(idx);
        if (onNavigate && safePosts[idx]) {
          onNavigate(safePosts[idx]);
        }
      }
    },
    [activeIndex, safePosts, onNavigate]
  );

  const renderSwipeItem = ({ item }: { item: any }) => {
    const postImage = item?.image_url || '';
    if (isTextOnly) {
      return (
        <View style={{ width: screenWidth, alignItems: 'center', justifyContent: 'center' }}>
          <View style={viewerStyles.textCard}>
            <View style={viewerStyles.textCardHandle} />
            <Text style={[viewerStyles.authorLabel, { textAlign: 'center', marginBottom: 12 }]}>
              {authorName}
            </Text>
            <Text style={viewerStyles.captionText}>{caption}</Text>
          </View>
        </View>
      );
    }
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setShowComments((v) => !v)}
        style={{ width: screenWidth }}
      >
        <Image
          source={{ uri: postImage }}
          style={{ width: screenWidth, height: screenWidth, backgroundColor: '#111' }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
        <Animated.View style={[viewerStyles.backdrop, { opacity: bgOpacity }]}>
          {/* Tap-to-dismiss background */}
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />

          {/* Dot indicators */}
          {safePosts.length > 1 && (
            <View style={viewerStyles.dotRow}>
              {safePosts.map((_: any, i: number) => (
                <View
                  key={i}
                  style={[
                    viewerStyles.dot,
                    { backgroundColor: i === activeIndex ? '#FFF' : 'rgba(255,255,255,0.4)' },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Swipeable image pager */}
          <Animated.View style={{ transform: [{ translateY }] }}>
            <FlatList
              ref={flatListRef}
              data={safePosts}
              renderItem={renderSwipeItem}
              keyExtractor={(item: any, index: number) => item.id || `post-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              initialNumToRender={3}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
            />
          </Animated.View>

          {/* Engagement + comments sheet */}
          {showComments && (
            <Animated.View style={[viewerStyles.igSheet, { transform: [{ translateY }] }]}>
              <View style={viewerStyles.sheetHandle} />
              <View style={viewerStyles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={viewerStyles.authorLabel}>{authorName}</Text>
                  <Text style={viewerStyles.metaLabel}>
                    {typeof timestamp === 'string'
                      ? timestamp
                      : new Date(timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                  </Text>
                </View>
                <TouchableOpacity style={viewerStyles.xBtn} onPress={() => setShowOptions(true)}>
                  <MoreHorizontal size={22} color="#CCC" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[viewerStyles.xBtn, { marginLeft: 8 }]}
                  onPress={() => {
                    Alert.alert('Delete Post', 'This action cannot be undone. Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.() },
                    ]);
                  }}
                >
                  <Trash2 size={22} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity style={viewerStyles.xBtn} onPress={handleClose}>
                  <X size={22} color="#CCC" />
                </TouchableOpacity>
              </View>

              {caption ? (
                <Text style={viewerStyles.captionText} numberOfLines={5}>
                  {caption}
                </Text>
              ) : null}

              <View style={viewerStyles.engagementRow}>
                <TouchableOpacity
                  onPress={toggleLikeLocal}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Heart
                    size={22}
                    color={liked ? '#EF4444' : '#999'}
                    fill={liked ? '#EF4444' : 'none'}
                  />
                  <Text style={viewerStyles.likesText}>
                    {likeCount} {likeCount === 1 ? 'like' : 'likes'}
                  </Text>
                </TouchableOpacity>
                {onReshare && (
                  <TouchableOpacity
                    onPress={onReshare}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 24 }}
                  >
                    <Forward size={20} color="#22C55E" />
                    <Text style={[viewerStyles.likesText, { color: '#22C55E' }]}>Reshare</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
                {comments.length === 0 ? (
                  <Text style={viewerStyles.noComments}>No comments yet. Be the first!</Text>
                ) : (
                  comments.map((c: any, i: number) => {
                    const cName =
                      c.author_id === 'me'
                        ? 'you'
                        : c.profiles?.full_name || c.profiles?.username || 'user';
                    return (
                      <View key={c.id || i} style={viewerStyles.commentRow}>
                        <Text style={viewerStyles.commentUser}>@{cName}</Text>
                        <Text style={viewerStyles.commentBody}>{c.content}</Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={viewerStyles.commentInputRow}>
                <TextInput
                  style={viewerStyles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#666"
                  value={commentText}
                  onChangeText={setCommentText}
                  onSubmitEditing={handleAddComment}
                  returnKeyType="send"
                />
                <TouchableOpacity onPress={handleAddComment} disabled={!commentText.trim() || commenting}>
                  <Send size={18} color={commentText.trim() ? '#3B82F6' : '#555'} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>

      {/* Options action sheet */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity
          style={viewerStyles.optionOverlay}
          activeOpacity={1}
          onPress={() => setShowOptions(false)}
        >
          <View style={[viewerStyles.optionSheet, { backgroundColor: '#1C1C1E' }]}>
            <TouchableOpacity
              style={viewerStyles.optionItem}
              onPress={() => {
                setShowOptions(false);
                setTimeout(() => {
                  Alert.alert('Delete Post', 'This action cannot be undone. Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => onDelete?.() },
                  ]);
                }, 350);
              }}
            >
              <Trash2 size={20} color="#EF4444" />
              <Text style={[viewerStyles.optionText, { color: '#EF4444' }]}>Delete Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[viewerStyles.optionItem, { borderTopWidth: 0 }]}
              onPress={() => setShowOptions(false)}
            >
              <X size={20} color="#999" />
              <Text style={[viewerStyles.optionText, { color: '#999' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Follow List Modal
// ═══════════════════════════════════════════════════════════════════════════

function FollowListModal({
  visible,
  title,
  list,
  onClose,
  onNavigateToUser,
}: {
  visible: boolean;
  title: string;
  list: any[];
  onClose: () => void;
  onNavigateToUser: (userId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={followStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={followStyles.sheet}>
          <View style={followStyles.handle} />
          <View style={followStyles.headerRow}>
            <Text style={followStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={followStyles.closeBtn}>
              <X size={20} color="#999" />
            </TouchableOpacity>
          </View>
          {list.length === 0 ? (
            <Text style={followStyles.empty}>No users yet</Text>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(item: any) => item.id || item.user_id}
              renderItem={({ item }: { item: any }) => {
                const name =
                  item.profiles?.full_name || item.profiles?.username || item.full_name || item.username || 'User';
                const username = item.profiles?.username || item.username || '';
                const avatar = item.profiles?.avatar_url || item.avatar_url || item.avatar || '';
                return (
                  <TouchableOpacity
                    style={followStyles.userRow}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onNavigateToUser(item.follower_id || item.following_id || item.user_id || item.id), 300);
                    }}
                  >
                    <Image source={{ uri: avatar || undefined }} style={followStyles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={followStyles.name}>{name}</Text>
                      {username ? <Text style={followStyles.username}>@{username}</Text> : null}
                    </View>
                    <ChevronRight size={18} color="#666" />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — User Profile Content
// ═══════════════════════════════════════════════════════════════════════════

export interface UserProfileContentProps {
  userId: string;
  isOwnProfile: boolean;
  myBundles?: any[];
  mySkills?: any[];
  grabbedPlans?: any[];
  onEditProfile?: () => void;
  onSettings?: () => void;
  onCreateBundle?: () => void;
  onCreateSkill?: () => void;
  onDeleteBundle?: (bundle: any) => void;
  onDeleteSkill?: (skill: any) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function UserProfileContent({
  userId,
  isOwnProfile,
  myBundles,
  mySkills,
  grabbedPlans,
  onEditProfile,
  onSettings,
  onCreateBundle,
  onCreateSkill,
  onDeleteBundle,
  onDeleteSkill,
  onPostDeleted,
}: UserProfileContentProps) {
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ── State ──
  const [profileData, setProfileData] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [userPostsCount, setUserPostsCount] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [otherBundles, setOtherBundles] = useState<any[]>([]);
  const [otherSkills, setOtherSkills] = useState<any[]>([]);

  // Viewer state
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPosts, setViewerPosts] = useState<any[]>([]);

  // Follow modal
  const [followModalType, setFollowModalType] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const [followModalVisible, setFollowModalVisible] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<string>('posts');

  // Colors
  const parentColor = isOwnProfile ? '#001F3D' : '#0D0D0D';

  // Bundles/skills to display
  const displayedBundles = useMemo(() => {
    if (isOwnProfile && myBundles !== undefined) return myBundles;
    return otherBundles;
  }, [isOwnProfile, myBundles, otherBundles]);

  const displayedSkills = useMemo(() => {
    if (isOwnProfile && mySkills !== undefined) return mySkills;
    return otherSkills;
  }, [isOwnProfile, mySkills, otherSkills]);

  // ── Profile Data Fetch ──
  const fetchProfileData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username, bio, location, avatar_url')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfileData(data);
      }
    } catch {}
  }, [userId]);

  // ── Posts Fetch ──
  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:user_id(full_name, username, avatar_url)')
        .eq('user_id', userId)
        .or('post_kind.is.null,post_kind.neq.reshare')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        setUserPosts(data);
        setUserPostsCount(data.length);
      }
    } catch {}
  }, [userId]);

  // ── Post Count Fetch ──
  const fetchPostCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or('post_kind.is.null,post_kind.neq.reshare');
      if (!error && count !== null) {
        setUserPostsCount(count);
      }
    } catch {}
  }, [userId]);

  // ── Followers/Following Counts ──
  const fetchFollowCounts = useCallback(async () => {
    try {
      const [{ count: fCount }, { count: gCount }] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', userId)
          .neq('follower_id', userId),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId)
          .neq('following_id', userId),
      ]);
      if (fCount !== null) setFollowersCount(fCount);
      if (gCount !== null) setFollowingCount(gCount);
    } catch {}
  }, [userId]);

  // ── Check if current user follows this user ──
  const checkFollowStatus = useCallback(async () => {
    if (isOwnProfile) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const followerId = authData?.user?.id;
      if (!followerId) return;
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', userId)
        .single();
      setIsFollowing(!!data);
    } catch {
      setIsFollowing(false);
    }
  }, [userId, isOwnProfile]);

  // ── Fetch other user's bundles/skills ──
  const fetchOtherBundles = useCallback(async () => {
    if (isOwnProfile) return;
    try {
      const { data } = await supabase
        .from('bundles')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });
      if (data) setOtherBundles(data);
    } catch {}
  }, [userId, isOwnProfile]);

  const fetchOtherSkills = useCallback(async () => {
    if (isOwnProfile) return;
    try {
      const { data } = await supabase.from('service_requests').select('*').eq('creator_id', userId).order('created_at', { ascending: false });
      if (data) setOtherSkills(data);
    } catch {}
  }, [userId, isOwnProfile]);

  // ── Load All ──
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchProfileData(),
      fetchPosts(),
      fetchFollowCounts(),
      checkFollowStatus(),
      fetchOtherBundles(),
      fetchOtherSkills(),
    ]);
    setIsLoading(false);
  }, [fetchProfileData, fetchPosts, fetchFollowCounts, checkFollowStatus, fetchOtherBundles, fetchOtherSkills]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProfileData(),
      fetchPosts(),
      fetchFollowCounts(),
      checkFollowStatus(),
      fetchOtherBundles(),
      fetchOtherSkills(),
    ]);
    setRefreshing(false);
  }, [fetchProfileData, fetchPosts, fetchFollowCounts, checkFollowStatus, fetchOtherBundles, fetchOtherSkills]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Entry Animation ──
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // ── Post Press Handler ──
  const handlePostPress = useCallback((post: any, posts: any[]) => {
    setSelectedPost(post);
    setViewerPosts(posts);
    setViewerVisible(true);
  }, []);

  // ── Delete Post ──
  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (!error) {
          const newPosts = userPosts.filter((p: any) => p.id !== postId);
          setUserPosts(newPosts);
          setViewerPosts((prev: any[]) => prev.filter((p: any) => p.id !== postId));
          if (userPostsCount !== null) setUserPostsCount((p) => (p !== null ? Math.max(0, p - 1) : null));
          setSelectedPost(null);
          setViewerVisible(false);
          onPostDeleted?.(postId);
        }
      } catch (e) {
        console.log('[Profile] delete post error:', e);
      }
    },
    [userPosts, userPostsCount]
  );

  // ── Navigate on viewer swipe ──
  const handleViewerNavigate = useCallback((post: any) => {
    setSelectedPost(post);
  }, []);

  // ── Follow/Unfollow ──
  const handleFollow = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (followLoading) return;
    setFollowLoading(true);

    const wasFollowing = isFollowing;
    const prevCount = followersCount;
    setIsFollowing(!wasFollowing);
    setFollowersCount((prev) => (wasFollowing ? Math.max(0, prev - 1) : prev + 1));

    try {
      const { data: authData } = await supabase.auth.getUser();
      const followerId = authData?.user?.id;
      if (!followerId) {
        setIsFollowing(wasFollowing);
        setFollowersCount(prevCount);
        setFollowLoading(false);
        return;
      }
      if (wasFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: userId });
        if (error) throw error;
      }
    } catch (e: any) {
      setIsFollowing(wasFollowing);
      setFollowersCount(prevCount);
      Alert.alert('Error', 'Failed to update follow status.');
    } finally {
      setFollowLoading(false);
    }
  }, [isFollowing, followersCount, userId, followLoading]);

  // ── Message ──
  const handleMessage = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/inbox/${userId}` as any);
  }, [router, userId]);

  // ── Follow List Modal ──
  const openFollowModal = useCallback(
    async (type: 'followers' | 'following') => {
      setFollowModalType(type);
      setFollowList([]);
      setFollowModalVisible(true);
      try {
        const column = type === 'followers' ? 'following_id' : 'follower_id';
        const joinCol = type === 'followers' ? 'follower_id' : 'following_id';
        const { data } = await supabase
          .from('follows')
          .select(`id, ${joinCol}, profiles:${joinCol}(full_name, username, avatar_url)`)
          .eq(column, userId)
          .neq(joinCol, userId)
          .limit(100);
        if (data) setFollowList(data);
      } catch {}
    },
    [userId]
  );

  const navigateToUser = useCallback(
    (targetUserId: string) => {
      if (!isOwnProfile || targetUserId === auth?.user?.id) {
        router.push(`/(tabs)/profile?userId=${targetUserId}` as any);
      } else {
        router.push(`/(tabs)/profile?userId=${targetUserId}` as any);
      }
    },
    [router, isOwnProfile, auth?.user?.id]
  );

  // ── Derived Values ──
  const userName = profileData?.full_name || (isOwnProfile ? auth?.user?.fullName : 'Unknown User');
  const userAvatar = profileData?.avatar_url || (isOwnProfile ? auth?.user?.avatar : '');
  const userBio = profileData?.bio || (isOwnProfile ? auth?.user?.bio : '');
  const userLocation = profileData?.location || (isOwnProfile ? auth?.user?.location : '');
  const userUsername = profileData?.username || (isOwnProfile ? auth?.user?.username : '');

  // ── Tab bar items ──
  const tabs = useMemo(() => {
    const items: string[] = ['posts', 'bundles', 'skills'];
    if (isOwnProfile) items.push('plans');
    return items;
  }, [isOwnProfile]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#FFF" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFF" />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* ════════════════ HEADER ════════════════ */}
          <View style={styles.profileHeader}>
            <LinearGradient
              colors={[parentColor, parentColor, '#1a1a2e']}
              style={styles.headerGradient}
            >
              {/* Stats Row */}
              <View style={styles.statsSection}>
                <View style={styles.statsGrid}>
                  <TouchableOpacity
                    style={[styles.statCard, { backgroundColor: ACCENT_COLORS.goldDim, borderColor: 'rgba(255,184,0,0.2)' }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statIconContainer, { backgroundColor: ACCENT_COLORS.goldDim }]}>
                      <Camera size={20} color={ACCENT_COLORS.gold} />
                    </View>
                    <Text style={[styles.statValue, { color: ACCENT_COLORS.gold }]}>
                      {userPostsCount ?? 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.6)' }]}>Posts</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.statCard, { backgroundColor: ACCENT_COLORS.coralDim, borderColor: 'rgba(255,107,107,0.2)' }]}
                    activeOpacity={0.7}
                    onPress={() => openFollowModal('followers')}
                  >
                    <View style={[styles.statIconContainer, { backgroundColor: ACCENT_COLORS.coralDim }]}>
                      <UserIcon size={20} color={ACCENT_COLORS.coral} />
                    </View>
                    <Text style={[styles.statValue, { color: ACCENT_COLORS.coral }]}>{followersCount}</Text>
                    <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.6)' }]}>Followers</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.statsGrid, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={[styles.statCard, { backgroundColor: ACCENT_COLORS.blueDim, borderColor: 'rgba(59,130,246,0.2)' }]}
                    activeOpacity={0.7}
                    onPress={() => openFollowModal('following')}
                  >
                    <View style={[styles.statIconContainer, { backgroundColor: ACCENT_COLORS.blueDim }]}>
                      <TrendingUp size={20} color={ACCENT_COLORS.blue} />
                    </View>
                    <Text style={[styles.statValue, { color: ACCENT_COLORS.blue }]}>{followingCount}</Text>
                    <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.6)' }]}>Following</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ════════════════ PROFILE INFO ════════════════ */}
          <View style={styles.avatarSection}>
            <Image
              source={{
                uri:
                  userAvatar ||
                  'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=random&size=200',
              }}
              style={styles.avatar}
            />
            <Text style={styles.userName}>{userName}</Text>
            {userUsername ? <Text style={styles.userUsername}>@{userUsername}</Text> : null}
            {userBio ? <Text style={styles.userBio}>{userBio}</Text> : null}
            {userLocation ? (
              <View style={styles.locationRow}>
                <MapPin size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.locationText}>{userLocation}</Text>
              </View>
            ) : null}
          </View>

          {/* ════════════════ BUTTONS ════════════════ */}
          <View style={styles.actionsRow}>
            {isOwnProfile ? (
              <>
                {onEditProfile && (
                  <TouchableOpacity style={styles.editButton} onPress={onEditProfile}>
                    <Edit3 size={16} color="#FFF" />
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                )}
                {onSettings && (
                  <TouchableOpacity style={styles.settingsChip} onPress={onSettings}>
                    <Settings size={16} color="#FFF" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.followBtn, isFollowing && styles.followingBtn]}
                  onPress={handleFollow}
                  disabled={followLoading}
                >
                  {isFollowing ? (
                    <UserMinus size={18} color="rgba(255,255,255,0.6)" />
                  ) : (
                    <UserPlus size={18} color="#FFF" />
                  )}
                  <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
                  <MessageCircle size={18} color="#3B82F6" />
                  <Text style={styles.messageBtnText}>Message</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ════════════════ TABS ════════════════ */}
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setActiveTab(tab);
                }}
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ════════════════ TAB CONTENT ════════════════ */}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <View style={styles.section}>
              <UserPostsGrid posts={userPosts} onPostPress={handlePostPress} />
            </View>
          )}

          {/* Bundles Tab */}
          {activeTab === 'bundles' && (
            <View style={styles.section}>
              {displayedBundles.length === 0 ? (
                <View style={styles.bundleEmptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(255,184,0,0.1)' }]}>
                    <Package size={28} color={ACCENT_COLORS.gold} />
                  </View>
                  <Text style={[styles.bundleEmptyTitle, { color: '#FFF' }]}>No Bundles Yet</Text>
                  <Text style={[styles.bundleEmptyText, { color: 'rgba(255,255,255,0.5)' }]}>
                    {isOwnProfile ? 'Create a bundle to offer your services.' : 'No bundles to show.'}
                  </Text>
                  {isOwnProfile && onCreateBundle && (
                    <TouchableOpacity
                      style={[styles.emptyStateButton, { backgroundColor: ACCENT_COLORS.gold }]}
                      onPress={onCreateBundle}
                    >
                      <Text style={[styles.emptyStateButtonText, { color: '#000' }]}>Create New Bundle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.bundlesList}>
                  {displayedBundles.map((b: any) => (
                    <View
                      key={b.id}
                      style={[styles.bundleCard, { backgroundColor: '#111', borderColor: '#222' }]}
                    >
                      <View style={styles.bundleCardLeft}>
                        <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.goldDim }]}>
                          <Package size={22} color={ACCENT_COLORS.gold} />
                        </View>
                      </View>
                      <View style={styles.bundleCardContent}>
                        <Text style={[styles.bundleTitle, { color: '#FFF' }]}>{b.title || b.name || 'Bundle'}</Text>
                        <View style={styles.bundleMetaRow}>
                          <View
                            style={[
                              styles.bundleStatusBadge,
                              { backgroundColor: ACCENT_COLORS.neonGreenDim },
                            ]}
                          >
                            <Text style={[styles.bundleStatusText, { color: ACCENT_COLORS.neonGreen }]}>
                              {b.status || 'active'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {b.proposed_budget !== undefined && (
                        <View style={styles.bundleCardRight}>
                          <Text style={[styles.bundleBudget, { color: ACCENT_COLORS.gold }]}>
                            ${b.proposed_budget}
                          </Text>
                        </View>
                      )}
                      {isOwnProfile && onDeleteBundle && (
                        <TouchableOpacity
                          style={{ padding: 8 }}
                          onPress={() => onDeleteBundle(b)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <View style={styles.section}>
              {displayedSkills.length === 0 ? (
                <View style={styles.bundleEmptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Zap size={28} color={ACCENT_COLORS.neonGreen} />
                  </View>
                  <Text style={[styles.bundleEmptyTitle, { color: '#FFF' }]}>No Skills Yet</Text>
                  <Text style={[styles.bundleEmptyText, { color: 'rgba(255,255,255,0.5)' }]}>
                    {isOwnProfile ? 'Create a skill to showcase your expertise.' : 'No skills to show.'}
                  </Text>
                  {isOwnProfile && onCreateSkill && (
                    <TouchableOpacity
                      style={[styles.emptyStateButton, { backgroundColor: ACCENT_COLORS.neonGreen }]}
                      onPress={onCreateSkill}
                    >
                      <Text style={[styles.emptyStateButtonText, { color: '#000' }]}>Create New Skill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.bundlesList}>
                  {displayedSkills.map((s: any) => (
                    <View
                      key={s.id}
                      style={[styles.bundleCard, { backgroundColor: '#111', borderColor: '#222' }]}
                    >
                      <View style={styles.bundleCardLeft}>
                        <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.neonGreenDim }]}>
                          <Zap size={22} color={ACCENT_COLORS.neonGreen} />
                        </View>
                      </View>
                      <View style={styles.bundleCardContent}>
                        <Text style={[styles.bundleTitle, { color: '#FFF' }]}>{s.title || s.name || 'Skill'}</Text>
                      </View>
                      {isOwnProfile && onDeleteSkill && (
                        <TouchableOpacity
                          style={{ padding: 8 }}
                          onPress={() => onDeleteSkill(s)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Plans Tab (own profile only) */}
          {activeTab === 'plans' && isOwnProfile && (
            <View style={styles.section}>
              {(!grabbedPlans || grabbedPlans.length === 0) ? (
                <View style={styles.bundleEmptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                    <Calendar size={28} color={ACCENT_COLORS.purple} />
                  </View>
                  <Text style={[styles.bundleEmptyTitle, { color: '#FFF' }]}>No Plans Yet</Text>
                  <Text style={[styles.bundleEmptyText, { color: 'rgba(255,255,255,0.5)' }]}>
                    Browse the planner to grab plans you like.
                  </Text>
                </View>
              ) : (
                <View style={styles.bundlesList}>
                  {grabbedPlans.map((plan: any) => (
                    <View
                      key={plan.id}
                      style={[styles.bundleCard, { backgroundColor: '#111', borderColor: '#222' }]}
                    >
                      <View style={styles.bundleCardLeft}>
                        <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.purpleDim }]}>
                          <Calendar size={22} color={ACCENT_COLORS.purple} />
                        </View>
                      </View>
                      <View style={styles.bundleCardContent}>
                        <Text style={[styles.bundleTitle, { color: '#FFF' }]}>{plan.title || 'Plan'}</Text>
                        <Text style={[styles.bundleDate, { color: 'rgba(255,255,255,0.5)' }]}>
                          {plan.pickup_time || plan.status || ''}
                        </Text>
                      </View>
                      {plan.proposed_budget !== undefined && (
                        <View style={styles.bundleCardRight}>
                          <Text style={[styles.bundleBudget, { color: ACCENT_COLORS.purple }]}>
                            ${plan.proposed_budget}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ════════════════ POST VIEWER ════════════════ */}
      <InstagramPostViewer
        visible={viewerVisible}
        post={selectedPost}
        allPosts={viewerPosts}
        onClose={() => {
          setViewerVisible(false);
          setSelectedPost(null);
        }}
        onNavigate={handleViewerNavigate}
        onDelete={selectedPost ? () => handleDeletePost(selectedPost.id) : undefined}
        onReshare={
          selectedPost
            ? async () => {
                try {
                  const { data: authData } = await supabase.auth.getUser();
                  const resharedById = authData?.user?.id;
                  if (!resharedById) return;
                  const originalMeta = {
                    type: 'reshare',
                    originalPostId: selectedPost.id,
                    originalAuthorName:
                      selectedPost.profiles?.full_name ||
                      selectedPost.authorName ||
                      'Unknown',
                    originalCaption: selectedPost.content || '',
                  };
                  await supabase.from('posts').insert({
                    user_id: resharedById,
                    content: JSON.stringify(originalMeta),
                    image_url: selectedPost.image_url || null,
                    post_kind: 'reshare',
                  });
                  await supabase
                    .from('posts')
                    .update({ shares: (selectedPost.shares || 0) + 1 })
                    .eq('id', selectedPost.id);
                  setViewerVisible(false);
                  setSelectedPost(null);
                  Alert.alert('Reshared!', 'Post has been reshared to your feed.');
                } catch (e: any) {
                  console.log('[Profile] reshare error:', e);
                }
              }
            : undefined
        }
      />

      {/* ════════════════ FOLLOW LIST MODAL ════════════════ */}
      <FollowListModal
        visible={followModalVisible}
        title={followModalType === 'followers' ? 'Followers' : 'Following'}
        list={followList}
        onClose={() => setFollowModalVisible(false)}
        onNavigateToUser={navigateToUser}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    marginBottom: -30,
  },
  headerGradient: {
    paddingBottom: 50,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -40,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#000',
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  userUsername: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  locationText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#333',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  settingsChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
  },
  followingBtn: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#333',
  },
  followBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  followingBtnText: {
    color: 'rgba(255,255,255,0.6)',
  },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  messageBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  statsSection: {
    paddingTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#3B82F6',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  tabLabelActive: {
    color: '#FFF',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bundlesList: {
    gap: 10,
  },
  bundleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bundleCardLeft: {
    marginRight: 12,
  },
  bundleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleCardContent: {
    flex: 1,
  },
  bundleTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  bundleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bundleStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bundleStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bundleDate: {
    fontSize: 12,
  },
  bundleCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  bundleBudget: {
    fontSize: 18,
    fontWeight: '700',
  },
  bundleEmptyState: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0a0a0a',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bundleEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  bundleEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyStateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

// ── Profile Grid Styles ──
const profileStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0 },
  gridEmpty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  gridEmptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridEmptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  gridEmptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  gridOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gridOverlayText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
});

// ── Viewer Styles ──
const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  igSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  authorLabel: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  metaLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  xBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionText: { fontSize: 14, color: '#DDD', lineHeight: 20, marginTop: 4 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  likesText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  textCard: {
    marginHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 'auto',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  textCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  optionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  optionSheet: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dotRow: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  noComments: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingVertical: 16 },
  commentRow: { flexDirection: 'row', gap: 6, paddingVertical: 6 },
  commentUser: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  commentBody: { fontSize: 13, color: '#DDD', flex: 1 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
  },
});

// ── Follow Modal Styles ──
const followStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 40,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#555', alignSelf: 'center', marginTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  closeBtn: { padding: 4 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  name: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  username: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  empty: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 30 },
});
