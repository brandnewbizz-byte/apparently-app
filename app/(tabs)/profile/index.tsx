import {
  Settings,
  Flame,
  DollarSign,
  Clock,
  MapPin,
  ChevronRight,
  Calendar,
  Package,
  Eye,
  MessageSquare,
  MessageCircle,
  ShoppingBag,
  Edit3,
  Star,
  TrendingUp,
  Award,
  User,
  Briefcase,
  Heart,
  X,
  Zap,
  Camera,
  Bookmark,
  Send,
  Plus,
} from 'lucide-react-native';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
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
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBundles } from '@/contexts/BundleContext';
import { useSkills } from '@/contexts/SkillContext';
import { useSocial } from '@/contexts/SocialContext';
import { useUserPosts } from '@/contexts/UserPostsContext';

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

interface GrabbedBundle {
  id: string;
  title: string;
  proposed_budget: number;
  pickup_time: string | null;
  status: string;
  booked_at: string;
  plan_details: {
    plan_date?: string;
    description?: string;
  } | null;
}

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// My Posts Grid — Instagram 3-column grid
// ═══════════════════════════════════════════════════════════════════════════

function UserPostsGrid({ colors, onPostPress }: { colors: any; onPostPress?: (post: any) => void }) {
  const { userPosts } = useUserPosts();

  // Only show this user's own posts — never mix in other users' content
  const allPosts: any[] = userPosts.map(up => ({
    id: up.id,
    imageUrl: up.mediaUri,
    caption: up.caption,
    likes: 0,
    timestamp: up.timestamp,
    type: 'photo',
    isOwnPost: true,
  }));

  if (!allPosts || allPosts.length === 0) {
    return (
      <View style={profileStyles.gridEmpty}>
        <View style={[profileStyles.gridEmptyIcon, { backgroundColor: ACCENT_COLORS.blueDim }]}>
          <Camera size={28} color={ACCENT_COLORS.blue} />
        </View>
        <Text style={[profileStyles.gridEmptyTitle, { color: colors.text }]}>No posts yet</Text>
        <Text style={[profileStyles.gridEmptyText, { color: colors.textSecondary }]}>
          Create a post to see it here
        </Text>
      </View>
    );
  }

  const COL_COUNT = 3;
  const GAP = 2;
  const IMG_SIZE = (Dimensions.get('window').width - GAP * (COL_COUNT - 1)) / COL_COUNT;

  return (
    <View style={profileStyles.grid}>
      {allPosts.map((post: any, idx: number) => (
        <TouchableOpacity
          key={post.id || idx}
          activeOpacity={0.8}
          style={{ width: IMG_SIZE, height: IMG_SIZE, marginRight: (idx % COL_COUNT) < COL_COUNT - 1 ? GAP : 0, marginBottom: GAP }}
          onPress={() => {
            if (onPostPress) onPostPress(post);
          }}
        >
          <Image
            source={{ uri: post.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400' }}
            style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }}
            resizeMode="cover"
          />
          {post.likes > 0 && (
            <View style={profileStyles.gridOverlay}>
              <Heart size={16} color="#FFF" fill="#FFF" />
              <Text style={profileStyles.gridOverlayText}>{post.likes}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EditProfileModal({
  visible, onClose, colors,
}: { visible: boolean; onClose: () => void; colors: any }) {
  const { user, updateAvatar } = useAuth();
  const [name, setName] = useState(user?.fullName || 'Roniel Lewis');
  const [bio, setBio] = useState('Building the future of compliance automation.');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [mediaPerm, requestMediaPerm] = ImagePicker.useMediaLibraryPermissions();
  const [saving, setSaving] = useState(false);

  const handlePickPhoto = async () => {
    const { status } = mediaPerm || {};
    if (status !== 'granted') {
      const result = await requestMediaPerm();
      if (!result.granted) {
        Alert.alert('Permission Required', 'We need access to your photos to change your avatar.');
        return;
      }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (avatarUrl && avatarUrl !== user?.avatar) {
        const result = await updateAvatar(avatarUrl);
        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to update avatar.');
          setSaving(false);
          return;
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.editModal, { backgroundColor: colors.background }]}>
        <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.editTitle, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity
            style={[styles.editSaveBtn, { backgroundColor: colors.accent }]}
            onPress={handleSave}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {/* Avatar */}
          <View style={{ alignItems: 'center' }}>
            <View style={styles.editAvatarWrap}>
              <Image
                source={{ uri: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }}
                style={styles.editAvatar}
              />
              <View style={[styles.editAvatarBadge, { backgroundColor: colors.accent }]}>
                <Camera size={12} color="#FFF" />
              </View>
            </View>
            <TouchableOpacity onPress={handlePickPhoto}>
              <Text style={[styles.editAvatarHint, { color: colors.accent }]}>Change photo</Text>
            </TouchableOpacity>
          </View>
          {/* Name */}
          <View>
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={name} onChangeText={setName}
            />
          </View>
          {/* Bio */}
          <View>
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Bio</Text>
            <TextInput
              style={[styles.editInput, styles.editBio, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={bio} onChangeText={setBio} multiline textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { myBundles, deleteBundle } = useBundles();
  const { mySkills, deleteSkill } = useSkills();
  
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [grabbedBundles, setGrabbedBundles] = useState<GrabbedBundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'bundles' | 'skills' | 'plans'>('posts');
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Helper: get deduplicated post count matching the grid display
  const { getAllPosts } = useSocial();
  const { userPosts } = useUserPosts();
  const getAllPostsForCount = useCallback(() => {
    const posts = getAllPosts() || [];
    const userPostIds = new Set(userPosts.map(up => up.id).filter(Boolean));
    const userPostUrls = new Set(userPosts.map(up => up.mediaUri).filter(Boolean));
    // Exclude social posts that match a user-created post (prevents double-counting)
    const uniqueSocial = posts.filter(p => {
      if (userPostIds.has(p.id)) return false;
      if (userPostUrls.has(p.imageUrl)) return false;
      return true;
    });
    return uniqueSocial.length + userPosts.length;
  }, [getAllPosts, userPosts]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const stats: StatItem[] = [
    {
      label: 'Earnings',
      value: `$${totalEarnings}`,
      icon: <DollarSign size={18} color={ACCENT_COLORS.neonGreen} />,
      color: ACCENT_COLORS.neonGreen,
      bgColor: ACCENT_COLORS.neonGreenDim,
    },
    {
      label: 'Streak',
      value: `${streak} days`,
      icon: <Flame size={18} color={ACCENT_COLORS.gold} />,
      color: ACCENT_COLORS.gold,
      bgColor: ACCENT_COLORS.goldDim,
    },
    {
      label: 'Rating',
      value: avgRating > 0 ? String(avgRating) : '—',
      icon: <Star size={18} color={ACCENT_COLORS.coral} />,
      color: ACCENT_COLORS.coral,
      bgColor: ACCENT_COLORS.coralDim,
    },
    {
      label: 'Completed',
      value: String(completedCount),
      icon: <Briefcase size={18} color={ACCENT_COLORS.blue} />,
      color: ACCENT_COLORS.blue,
      bgColor: ACCENT_COLORS.blueDim,
    },
  ];

  const fetchProfileStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: jobs } = await supabase
        .from('job_requests')
        .select('proposed_budget, status')
        .eq('seller_id', user.id);
      if (jobs) {
        const completed = jobs.filter((j: any) => j.status === 'completed');
        setCompletedCount(completed.length);
        const earnings = jobs.reduce((sum: number, j: any) => sum + Number(j.proposed_budget || 0), 0);
        setTotalEarnings(earnings);
      }
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: recentPosts } = await supabase
        .from('social_posts')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo.toISOString());
      if (recentPosts && recentPosts.length > 0) {
        const activeDays = new Set(recentPosts.map((p: any) => p.created_at?.split('T')[0]));
        setStreak(activeDays.size);
      }
      const { data: reviews } = await supabase
        .from('user_reviews')
        .select('rating')
        .eq('reviewed_user_id', user.id);
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    } catch (err) {
      console.log('[Profile] Error fetching stats:', err);
    }
  }, [user?.id]);

  const fetchGrabbedBundles = useCallback(async () => {
    if (!user?.id) {
      setLoadingBundles(false);
      return;
    }
    try {
      setLoadingBundles(true);
      const { data, error } = await supabase
        .from('job_requests')
        .select('id, title, proposed_budget, pickup_time, status, booked_at, plan_details')
        .eq('user_id', user.id)
        .eq('type', 'plan_for_hire')
        .order('booked_at', { ascending: false });
      if (error) {
        console.log('[Profile] Error fetching grabbed bundles:', error.message);
      } else {
        setGrabbedBundles(data || []);
      }
    } catch (err) {
      console.log('[Profile] Exception fetching grabbed bundles:', err);
    } finally {
      setLoadingBundles(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchProfileStats(); }, [fetchProfileStats]);
  useEffect(() => { fetchGrabbedBundles(); }, [fetchGrabbedBundles]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const handleViewBundleDetails = useCallback((bundle: GrabbedBundle) => {
    console.log('View bundle details:', bundle.id);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/(tabs)/planner/${bundle.id}` as any);
  }, [router]);

  const handleChatPlanner = useCallback((bundle: GrabbedBundle) => {
    console.log('Chat planner for bundle:', bundle.id);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/inbox' as any);
  }, [router]);

  const formatBundleDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return ACCENT_COLORS.neonGreen;
      case 'in_progress': return ACCENT_COLORS.gold;
      case 'pending': return colors.textTertiary;
      case 'cancelled': return ACCENT_COLORS.coral;
      default: return colors.textSecondary;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfileStats(), fetchGrabbedBundles()]);
    setRefreshing(false);
  }, [fetchProfileStats, fetchGrabbedBundles]);

  const userName = user?.fullName || user?.username || 'User';
  const userAvatar = user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop';
  const userBio = 'Ready to grab opportunities!';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT_COLORS.gold}
          />
        }
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <LinearGradient
              colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
            >
              <TouchableOpacity 
                style={styles.shopButton}
                onPress={() => router.push('/book' as any)}
              >
                <ShoppingBag size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={() => router.push('/profile/settings' as any)}
              >
                <Settings size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: userAvatar }} style={styles.avatar} />
                  <TouchableOpacity style={styles.editAvatarButton} onPress={() => setShowEditProfile(true)}>
                    <Edit3 size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userBio}>{userBio}</Text>
              </View>

              {/* Streak Badge */}
              <View style={styles.streakContainer}>
                <View style={styles.streakBadge}>
                  <Flame size={16} color={ACCENT_COLORS.gold} />
                  <Text style={styles.streakText}>{streak} day streak</Text>
                  <Text style={styles.streakBonus}>🔥</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Instagram-Style Stats Row */}
          <View style={{ paddingHorizontal: 32, paddingTop: 28, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{getAllPostsForCount()}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>posts</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{myBundles.length}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>bundles</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{grabbedBundles.length}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>grabbed</Text>
            </View>
          </View>

          {/* Tab Bar */}
          <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.border }}>
            {(['posts', 'bundles', 'skills', 'plans'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.text : 'transparent' }}
              >
                <Text style={{ fontSize: 12, fontWeight: activeTab === tab ? '700' : '500', color: activeTab === tab ? colors.text : colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={{ paddingBottom: 100 }}>
            {activeTab === 'posts' && <UserPostsGrid colors={colors} onPostPress={(post: any) => setSelectedPost(post)} />}

            {activeTab === 'bundles' && (
              <View style={{ paddingTop: 8 }}>
                {/* Add New Bundle header — always visible */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{myBundles.length} bundle{myBundles.length !== 1 ? 's' : ''}</Text>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: ACCENT_COLORS.purpleDim }} onPress={() => router.push('/bundle-builder' as any)}>
                    <Plus size={16} color={ACCENT_COLORS.purple} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT_COLORS.purple }}>New Bundle</Text>
                  </TouchableOpacity>
                </View>
                {myBundles.length === 0 ? (
                  <View style={[styles.bundleEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: ACCENT_COLORS.purpleDim }]}>
                      <Package size={32} color={ACCENT_COLORS.purple} />
                    </View>
                    <Text style={[styles.bundleEmptyTitle, { color: colors.text }]}>No bundles yet</Text>
                    <Text style={[styles.bundleEmptyText, { color: colors.textSecondary }]}>Create a bundle to offer multiple services together</Text>
                    <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: ACCENT_COLORS.purpleDim }]} onPress={() => router.push('/bundle-builder' as any)}>
                      <Text style={[styles.emptyStateButtonText, { color: ACCENT_COLORS.purple }]}>Create Bundle</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  myBundles.map((bundle) => (
                    <TouchableOpacity key={bundle.id} style={[styles.bundleCard, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: 16, marginBottom: 8 }]} activeOpacity={0.7}>
                      <View style={styles.bundleCardLeft}>
                        <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.purpleDim }]}>
                          <Package size={20} color={ACCENT_COLORS.purple} />
                        </View>
                      </View>
                      <View style={styles.bundleCardContent}>
                        <Text style={[styles.bundleTitle, { color: colors.text }]} numberOfLines={1}>{bundle.title}</Text>
                        <Text style={[styles.bundleDate, { color: colors.textTertiary }]}>{bundle.grabCount} grabs</Text>
                      </View>
                      <View style={styles.bundleCardRight}>
                        <Text style={[styles.bundleBudget, { color: ACCENT_COLORS.neonGreen }]}>${bundle.price}</Text>
                        <TouchableOpacity onPress={() => deleteBundle(bundle.id)}><X size={18} color={colors.textTertiary} /></TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {activeTab === 'skills' && (
              <View style={{ paddingTop: 8 }}>
                {/* Add New Skill header — always visible */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{mySkills.length} skill{mySkills.length !== 1 ? 's' : ''}</Text>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: ACCENT_COLORS.coralDim }} onPress={() => router.push('/skill-builder' as any)}>
                    <Plus size={16} color={ACCENT_COLORS.coral} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT_COLORS.coral }}>New Skill</Text>
                  </TouchableOpacity>
                </View>
                {mySkills.length === 0 ? (
                  <View style={[styles.bundleEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: ACCENT_COLORS.coralDim }]}>
                      <Zap size={32} color={ACCENT_COLORS.coral} />
                    </View>
                    <Text style={[styles.bundleEmptyTitle, { color: colors.text }]}>No skills posted</Text>
                    <Text style={[styles.bundleEmptyText, { color: colors.textSecondary }]}>Post a skill to offer your services on the marketplace</Text>
                    <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: ACCENT_COLORS.coralDim }]} onPress={() => router.push('/skill-builder' as any)}>
                      <Text style={[styles.emptyStateButtonText, { color: ACCENT_COLORS.coral }]}>Post a Skill</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  mySkills.map((skill) => (
                    <TouchableOpacity key={skill.id} style={[styles.bundleCard, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: 16, marginBottom: 8 }]} activeOpacity={0.7}>
                      <View style={styles.bundleCardLeft}>
                        <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.coralDim }]}>
                          {skill.imageUrl ? (
                            <Image source={{ uri: skill.imageUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                          ) : (
                            <Text style={{ fontSize: 20 }}>{skill.icon}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.bundleCardContent}>
                        <Text style={[styles.bundleTitle, { color: colors.text }]} numberOfLines={1}>{skill.title}</Text>
                        <Text style={[styles.bundleDate, { color: colors.textTertiary }]}>{skill.grabCount} grabs</Text>
                      </View>
                      <View style={styles.bundleCardRight}>
                        <Text style={[styles.bundleBudget, { color: ACCENT_COLORS.neonGreen }]}>${skill.price}</Text>
                        <TouchableOpacity onPress={() => deleteSkill(skill.id)}><X size={18} color={colors.textTertiary} /></TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {activeTab === 'plans' && (
              <View style={{ paddingTop: 8 }}>
                {loadingBundles ? (
                  <View style={[styles.bundleLoadingContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.bundleLoadingText, { color: colors.textSecondary }]}>Loading...</Text>
                  </View>
                ) : grabbedBundles.length === 0 ? (
                  <View style={[styles.bundleEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: ACCENT_COLORS.goldDim }]}>
                      <Package size={32} color={ACCENT_COLORS.gold} />
                    </View>
                    <Text style={[styles.bundleEmptyTitle, { color: colors.text }]}>No plans yet</Text>
                    <Text style={[styles.bundleEmptyText, { color: colors.textSecondary }]}>Grab a plan bundle to see it here</Text>
                    <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: ACCENT_COLORS.goldDim }]} onPress={() => router.push('/(tabs)/planner' as any)}>
                      <Text style={[styles.emptyStateButtonText, { color: ACCENT_COLORS.gold }]}>Browse Plans</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  grabbedBundles.map((bundle) => (
                    <TouchableOpacity key={bundle.id} style={[styles.bundleCard, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: 16, marginBottom: 8 }]} onPress={() => handleViewBundleDetails(bundle)} activeOpacity={0.7}>
                      <View style={styles.bundleCardLeft}>
                        <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.goldDim }]}>
                          <Package size={20} color={ACCENT_COLORS.gold} />
                        </View>
                      </View>
                      <View style={styles.bundleCardContent}>
                        <Text style={[styles.bundleTitle, { color: colors.text }]} numberOfLines={1}>{bundle.title}</Text>
                        <Text style={[styles.bundleDate, { color: colors.textTertiary }]}>{formatBundleDate(bundle.booked_at)}</Text>
                      </View>
                      <View style={styles.bundleCardRight}>
                        <Text style={[styles.bundleBudget, { color: ACCENT_COLORS.neonGreen }]}>${bundle.proposed_budget}</Text>
                        <ChevronRight size={18} color={colors.textTertiary} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Post Viewer Modal — Instagram-style fullscreen */}
      <InstagramPostViewer
        visible={!!selectedPost}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        colors={colors}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        colors={colors}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Instagram-Style Fullscreen Post Viewer
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Instagram-Style Fullscreen Post Viewer (profile)
// ═══════════════════════════════════════════════════════════════════════════
function InstagramPostViewer({ visible, post, onClose, colors }: {
  visible: boolean;
  post: any;
  onClose: () => void;
  colors: any;
}) {
  const translateY = useRef(new Animated.Value(300)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(300);
      bgOpacity.setValue(0);
    }
  }, [visible]);

  if (!post) return null;

  // Use ONLY post data — never fall back to current user
  const authorName = post.user?.name || post.author_name || post.author?.name || '@user';
  const caption = post.caption || post.content || '';
  const likes = post.likes ?? 0;
  const timestamp = post.timestamp || post.created_at || '';
  const imageUrl = post.imageUrl || post.image_url || '';

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!imageUrl) {
    // No image — just show text post
    return (
      <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
        <View style={viewerStyles.backdrop}>
          <Animated.View style={[viewerStyles.textCard, { transform: [{ translateY }] }]}>
            <View style={viewerStyles.textCardHandle} />
            <Text style={viewerStyles.authorLabel}>{authorName}</Text>
            <Text style={viewerStyles.captionText}>{caption || 'No caption'}</Text>
            <View style={viewerStyles.engagementRow}>
              <Heart size={20} color={likes > 0 ? '#EF4444' : '#999'} fill={likes > 0 ? '#EF4444' : 'none'} />
              <Text style={viewerStyles.likesText}>{likes}</Text>
            </View>
            <TouchableOpacity style={viewerStyles.dismissBtn} onPress={handleClose}>
              <Text style={viewerStyles.dismissBtnText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <Animated.View style={[viewerStyles.backdrop, { opacity: bgOpacity }]}>
        {/* Tap-to-dismiss background */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />

        {/* Image — full-width, Instagram-style */}
        <Animated.Image
          source={{ uri: imageUrl }}
          style={[
            viewerStyles.igImage,
            { width: screenWidth, height: screenHeight * 0.55, transform: [{ translateY }] },
          ]}
          resizeMode="cover"
        />

        {/* Bottom sheet */}
        <Animated.View style={[viewerStyles.igSheet, { transform: [{ translateY }] }]}>
          {/* Drag handle */}
          <View style={viewerStyles.sheetHandle} />

          {/* Author + close row */}
          <View style={viewerStyles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={viewerStyles.authorLabel}>{authorName}</Text>
              <Text style={viewerStyles.metaLabel}>
                {typeof timestamp === 'string' ? timestamp : new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity style={viewerStyles.xBtn} onPress={handleClose}>
              <X size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Caption */}
          {caption ? (
            <Text style={viewerStyles.captionText} numberOfLines={5}>
              {caption}
            </Text>
          ) : null}

          {/* Engagement row */}
          <View style={viewerStyles.engagementRow}>
            <Heart size={22} color={likes > 0 ? '#EF4444' : '#999'} fill={likes > 0 ? '#EF4444' : 'none'} />
            <Text style={viewerStyles.likesText}>{likes} {likes === 1 ? 'like' : 'likes'}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileHeader: {
    marginBottom: -20,
  },
  headerGradient: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  shopButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 16,
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  streakContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  streakBonus: {
    fontSize: 14,
  },
  statsSection: {
    paddingHorizontal: 16,
    paddingTop: 36,
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
    fontWeight: '800' as const,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  quickActionsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    flex: 1,
    marginLeft: 14,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  quickActionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  bundleLoadingContainer: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 16,
  },
  bundleLoadingText: {
    fontSize: 14,
  },
  bundleEmptyState: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
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
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  bundleEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
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
    fontWeight: '700' as const,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  activityCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  activityText: {
    flex: 1,
    fontSize: 14,
  },
  activityTime: {
    fontSize: 12,
  },
  // ── Edit Profile Modal ──
  editModal: { flex: 1 },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  editTitle: { fontSize: 17, fontWeight: '700' },
  editSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  editAvatarWrap: { position: 'relative', marginBottom: 8 },
  editAvatar: { width: 80, height: 80, borderRadius: 40 },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  editAvatarHint: { fontSize: 13, fontWeight: '600' },
  editLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  editInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  editBio: { minHeight: 80 },
});

// ── Instagram Post Styles ──
const igStyles = StyleSheet.create({
  postsContainer: { gap: 16 },
  postCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postHeaderText: { gap: 1 },
  postUsername: { fontSize: 13, fontWeight: '700' },
  postLocation: { fontSize: 11 },
  postMenuBtn: { padding: 4 },
  postMenuDots: { fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  postImage: { width: '100%', height: 340 },
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 10 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { padding: 4 },
  likesRow: { paddingHorizontal: 12, paddingTop: 6 },
  likesText: { fontSize: 13, lineHeight: 18 },
  boldText: { fontWeight: '700' },
  captionRow: { paddingHorizontal: 12, paddingTop: 4 },
  captionText: { fontSize: 13, lineHeight: 18 },
  commentsLink: { paddingHorizontal: 12, paddingTop: 4 },
  commentsLinkText: { fontSize: 13 },
  postTimestamp: { fontSize: 11, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ── Instagram Grid Styles ──
const profileStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0 },
  gridEmpty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  gridEmptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridEmptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  gridEmptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  gridOverlay: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  gridOverlayText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
});

// ── Instagram Post Viewer Styles ──
const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  // Image post
  igImage: { backgroundColor: '#111' },
  igSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 40, paddingHorizontal: 16,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  authorLabel: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  metaLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  xBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  captionText: { fontSize: 14, color: '#DDD', lineHeight: 20, marginTop: 4 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  likesText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  // Text-only post
  textCard: {
    marginHorizontal: 24, marginTop: 'auto', marginBottom: 'auto',
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24, alignItems: 'center',
  },
  textCardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  dismissBtn: { marginTop: 16, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  dismissBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  // Keep backward compat
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  dismissArea: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  container: { width: '100%', alignItems: 'center', zIndex: 1 },
  closeButton: { position: 'absolute', top: 56, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  image: { width: Dimensions.get('window').width, height: Dimensions.get('window').width, backgroundColor: '#0a0a0a' },
  infoSheet: { width: '100%', paddingTop: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333' },
  authorName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  caption: { fontSize: 14, color: '#FFF', paddingHorizontal: 16, paddingTop: 8, lineHeight: 20 },
  timestamp: { fontSize: 11, color: 'rgba(255,255,255,0.45)', paddingHorizontal: 16, paddingTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
});
