import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Link as LinkIcon,
  Calendar,
  UserPlus,
  UserMinus,
  MessageCircle,
  MoreHorizontal,
  Grid3X3,
  Heart,
  Image as ImageIcon,
  Bell,
  BellOff,
  Star,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { mockUsers, mockPosts } from '@/mocks/data';
import PostCard from '@/components/PostCard';
import { supabase } from '@/lib/supabase';

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isNotificationsOn, setIsNotificationsOn] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'posts' | 'media' | 'likes'>('posts');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const followButtonScale = useRef(new Animated.Value(1)).current;

  const user = mockUsers.find(u => u.id === userId) || mockUsers[0];
  const userPosts = mockPosts.filter(p => p.user.id === userId);
  const userMedia = mockPosts.filter(p => p.user.id === userId && p.imageUrl);

  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  
  useEffect(() => {
    setFollowersCount(user.followersCount);
  }, [user.followersCount]);

  useEffect(() => {
    let isMounted = true;

    const loadRating = async () => {
      try {
        if (!userId) return;
        console.log('[UserProfile] Loading average rating for:', userId);

        const { data, error } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', userId);

        if (error) {
          console.error('[UserProfile] Error loading reviews:', error);
          if (isMounted) {
            setAvgRating(null);
            setReviewsCount(0);
          }
          return;
        }

        const ratings = (data ?? [])
          .map((r: any) => (typeof r?.rating === 'number' ? r.rating : Number(r?.rating)))
          .filter((n: number) => Number.isFinite(n));

        const count = ratings.length;
        const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : null;

        console.log('[UserProfile] Rating computed:', { count, avg });

        if (isMounted) {
          setReviewsCount(count);
          setAvgRating(avg);
        }
      } catch (e) {
        console.error('[UserProfile] loadRating exception:', e);
        if (isMounted) {
          setAvgRating(null);
          setReviewsCount(0);
        }
      }
    };

    loadRating();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleFollow = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Animated.sequence([
      Animated.timing(followButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(followButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsFollowing(!isFollowing);
    setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
    console.log('[UserProfile] Toggle follow user:', userId, !isFollowing);
  };

  const handleMessage = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      'Start Conversation',
      `Send a message to ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Message', 
          onPress: () => console.log('[UserProfile] Open chat with:', userId)
        }
      ]
    );
  };
  
  const handleToggleNotifications = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsNotificationsOn(!isNotificationsOn);
    Alert.alert(
      isNotificationsOn ? 'Notifications Off' : 'Notifications On',
      isNotificationsOn 
        ? `You won't receive notifications from ${user.name}`
        : `You'll receive notifications when ${user.name} posts`
    );
  };
  
  const handleMoreOptions = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      user.name,
      'More options',
      [
        { 
          text: 'Share Profile', 
          onPress: () => console.log('[UserProfile] Share profile:', userId)
        },
        { 
          text: 'Block User', 
          onPress: () => {
            Alert.alert(
              'Block User',
              `Are you sure you want to block ${user.name}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => console.log('[UserProfile] Block:', userId) }
              ]
            );
          },
          style: 'destructive'
        },
        { 
          text: 'Report User', 
          onPress: () => console.log('[UserProfile] Report:', userId),
          style: 'destructive'
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleTabPress = (tab: 'posts' | 'media' | 'likes') => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setActiveTab(tab);
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{user.username}</Text>
        <TouchableOpacity style={styles.moreButton} onPress={handleMoreOptions}>
          <MoreHorizontal size={24} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {user.isLive && (
                <LinearGradient
                  colors={[Colors.dark.live, '#FF6B9D', Colors.dark.live]}
                  style={styles.liveRing}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
              {user.isLive && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.name}</Text>
              {user.isVerified && (
                <BadgeCheck size={22} color={Colors.dark.accent} />
              )}
            </View>

            <View style={styles.ratingRow}>
              {avgRating !== null ? (
                <View style={styles.ratingPill} testID="profileAvgRating">
                  <Star size={14} color="#FFB300" fill="#FFB300" />
                  <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
                  <Text style={styles.ratingMeta}>({reviewsCount})</Text>
                </View>
              ) : (
                <View style={[styles.ratingPill, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: Colors.dark.border }]} testID="profileNoRating">
                  <Star size={14} color={Colors.dark.textTertiary} />
                  <Text style={[styles.ratingMeta, { color: Colors.dark.textTertiary }]}>No ratings</Text>
                </View>
              )}
            </View>

            <Text style={styles.username}>@{user.username}</Text>

            <Text style={styles.bio}>
              Creating content that matters. Life is about connections and growth.
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MapPin size={14} color={Colors.dark.textTertiary} />
                <Text style={styles.metaText}>New York, NY</Text>
              </View>
              <View style={styles.metaItem}>
                <LinkIcon size={14} color={Colors.dark.textTertiary} />
                <Text style={[styles.metaText, styles.linkText]}>{user.username}.com</Text>
              </View>
              <View style={styles.metaItem}>
                <Calendar size={14} color={Colors.dark.textTertiary} />
                <Text style={styles.metaText}>Joined Jan 2024</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statValue}>{formatFollowers(followersCount)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statValue}>{Math.floor(user.followersCount / 100)}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statValue}>{userPosts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionsRow}>
              <Animated.View style={[styles.followButtonWrapper, { transform: [{ scale: followButtonScale }] }]}>
                <TouchableOpacity 
                  style={[styles.followButton, isFollowing && styles.followingButton]} 
                  onPress={handleFollow}
                >
                  {isFollowing ? (
                    <UserMinus size={18} color={Colors.dark.textSecondary} />
                  ) : (
                    <UserPlus size={18} color={Colors.dark.text} />
                  )}
                  <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                <MessageCircle size={18} color={Colors.dark.accent} />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
              {isFollowing && (
                <TouchableOpacity 
                  style={styles.notificationButton} 
                  onPress={handleToggleNotifications}
                >
                  {isNotificationsOn ? (
                    <BellOff size={18} color={Colors.dark.textSecondary} />
                  ) : (
                    <Bell size={18} color={Colors.dark.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
              onPress={() => handleTabPress('posts')}
            >
              <Grid3X3 size={20} color={activeTab === 'posts' ? Colors.dark.accent : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'media' && styles.tabActive]}
              onPress={() => handleTabPress('media')}
            >
              <ImageIcon size={20} color={activeTab === 'media' ? Colors.dark.accent : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'media' && styles.tabTextActive]}>Media</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
              onPress={() => handleTabPress('likes')}
            >
              <Heart size={20} color={activeTab === 'likes' ? Colors.dark.accent : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'likes' && styles.tabTextActive]}>Likes</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.postsSection}>
            {activeTab === 'posts' && (
              userPosts.length > 0 ? (
                userPosts.map((post) => (
                  <View key={post.id} style={styles.postWrapper}>
                    <PostCard post={post} />
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Grid3X3 size={48} color={Colors.dark.textTertiary} />
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubtext}>
                    When {user.name.split(' ')[0]} posts, you&apos;ll see them here.
                  </Text>
                </View>
              )
            )}
            
            {activeTab === 'media' && (
              userMedia.length > 0 ? (
                <View style={styles.mediaGrid}>
                  {userMedia.map((post) => (
                    <TouchableOpacity key={post.id} style={styles.mediaItem}>
                      <Image 
                        source={{ uri: post.imageUrl }} 
                        style={styles.mediaImage} 
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <ImageIcon size={48} color={Colors.dark.textTertiary} />
                  <Text style={styles.emptyText}>No media yet</Text>
                  <Text style={styles.emptySubtext}>
                    Photos and videos will appear here.
                  </Text>
                </View>
              )
            )}
            
            {activeTab === 'likes' && (
              <View style={styles.emptyState}>
                <Heart size={48} color={Colors.dark.textTertiary} />
                <Text style={styles.emptyText}>Likes are private</Text>
                <Text style={styles.emptySubtext}>
                  Only {user.name.split(' ')[0]} can see their likes.
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  liveRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 52,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: Colors.dark.background,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    backgroundColor: Colors.dark.live,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 179, 0, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.25)',
  },
  ratingValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  ratingMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  username: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  linkText: {
    color: Colors.dark.accent,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.dark.border,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  followButtonWrapper: {
    flex: 1,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.accent,
  },
  followingButton: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  followingButtonText: {
    color: Colors.dark.textSecondary,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.accent,
  },
  messageButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.accent,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.accent,
  },
  postsSection: {
    padding: 16,
  },
  postWrapper: {
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  mediaItem: {
    width: '32.8%',
    aspectRatio: 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.backgroundTertiary,
  },
});
