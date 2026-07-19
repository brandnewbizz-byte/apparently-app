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
  ShoppingBag,
  Edit3,
  Star,
  TrendingUp,
  Award,
  User,
  Briefcase,
  Heart,
} from 'lucide-react-native';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(6);
  const [totalEarnings, setTotalEarnings] = useState(128);
  const [grabbedBundles, setGrabbedBundles] = useState<GrabbedBundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  
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
      value: '4.9',
      icon: <Star size={18} color={ACCENT_COLORS.coral} />,
      color: ACCENT_COLORS.coral,
      bgColor: ACCENT_COLORS.coralDim,
    },
    {
      label: 'Completed',
      value: '24',
      icon: <Briefcase size={18} color={ACCENT_COLORS.blue} />,
      color: ACCENT_COLORS.blue,
      bgColor: ACCENT_COLORS.blueDim,
    },
  ];

  useEffect(() => {
    const fetchGrabbedBundles = async () => {
      if (!user?.id) {
        setLoadingBundles(false);
        return;
      }

      try {
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
          console.log('Grabbed bundles loaded:', (data || []).length);
        }
      } catch (err) {
        console.log('[Profile] Exception fetching grabbed bundles:', err);
      } finally {
        setLoadingBundles(false);
      }
    };

    fetchGrabbedBundles();
  }, [user?.id]);

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
    router.push('/(tabs)/inbox' as any);
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

  const onRefresh = useCallback(() => {
    console.log('[Profile] Refreshing...');
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const userName = profile?.full_name || profile?.username || 'User';
  const userAvatar = profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop';
  const userBio = profile?.bio || 'Ready to grab opportunities!';

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
                onPress={() => router.push('/(tabs)/book' as any)}
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
                  <TouchableOpacity style={styles.editAvatarButton}>
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

          {/* Stats Grid */}
          <View style={[styles.statsSection, { backgroundColor: colors.background }]}>
            <View style={styles.statsGrid}>
              {stats.map((stat, index) => (
                <View 
                  key={index} 
                  style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: stat.bgColor }]}>
                    {stat.icon}
                  </View>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <TouchableOpacity 
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/planner' as any)}
            >
              <LinearGradient
                colors={[ACCENT_COLORS.gold, '#FF8C00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickActionGradient}
              >
                <Calendar size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.quickActionText}>
                <Text style={[styles.quickActionTitle, { color: colors.text }]}>Plan Your Day</Text>
                <Text style={[styles.quickActionSubtitle, { color: colors.textSecondary }]}>Optimize schedule</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/book' as any)}
            >
              <LinearGradient
                colors={[ACCENT_COLORS.neonGreen, '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickActionGradient}
              >
                <TrendingUp size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.quickActionText}>
                <Text style={[styles.quickActionTitle, { color: colors.text }]}>Browse Gigs</Text>
                <Text style={[styles.quickActionSubtitle, { color: colors.textSecondary }]}>Find opportunities</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Grabbed Plans Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Grabbed Plans</Text>
              <Award size={20} color={ACCENT_COLORS.gold} />
            </View>
            
            {loadingBundles ? (
              <View style={[styles.bundleLoadingContainer, { backgroundColor: colors.surface }]}>
                <Text style={[styles.bundleLoadingText, { color: colors.textSecondary }]}>Loading plans...</Text>
              </View>
            ) : grabbedBundles.length === 0 ? (
              <View style={[styles.bundleEmptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.emptyIconContainer, { backgroundColor: ACCENT_COLORS.goldDim }]}>
                  <Package size={32} color={ACCENT_COLORS.gold} />
                </View>
                <Text style={[styles.bundleEmptyTitle, { color: colors.text }]}>No plans yet</Text>
                <Text style={[styles.bundleEmptyText, { color: colors.textSecondary }]}>
                  Grab a plan bundle to see it here
                </Text>
                <TouchableOpacity 
                  style={[styles.emptyStateButton, { backgroundColor: ACCENT_COLORS.goldDim }]}
                  onPress={() => router.push('/(tabs)/planner' as any)}
                >
                  <Text style={[styles.emptyStateButtonText, { color: ACCENT_COLORS.gold }]}>Browse Plans</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bundlesList}>
                {grabbedBundles.slice(0, 3).map((bundle) => (
                  <TouchableOpacity 
                    key={bundle.id} 
                    style={[styles.bundleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleViewBundleDetails(bundle)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.bundleCardLeft}>
                      <View style={[styles.bundleIconContainer, { backgroundColor: ACCENT_COLORS.goldDim }]}>
                        <Package size={20} color={ACCENT_COLORS.gold} />
                      </View>
                    </View>
                    <View style={styles.bundleCardContent}>
                      <Text style={[styles.bundleTitle, { color: colors.text }]} numberOfLines={1}>
                        {bundle.title}
                      </Text>
                      <View style={styles.bundleMetaRow}>
                        <View style={[styles.bundleStatusBadge, { backgroundColor: `${getStatusColor(bundle.status)}20` }]}>
                          <Text style={[styles.bundleStatusText, { color: getStatusColor(bundle.status) }]}>
                            {bundle.status.replace('_', ' ')}
                          </Text>
                        </View>
                        <Text style={[styles.bundleDate, { color: colors.textTertiary }]}>
                          {formatBundleDate(bundle.booked_at)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bundleCardRight}>
                      <Text style={[styles.bundleBudget, { color: ACCENT_COLORS.neonGreen }]}>
                        ${bundle.proposed_budget}
                      </Text>
                      <ChevronRight size={18} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))}
                {grabbedBundles.length > 3 && (
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={[styles.viewAllText, { color: ACCENT_COLORS.gold }]}>
                      View all {grabbedBundles.length} plans
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Activity Section */}
          <View style={[styles.section, { marginBottom: 100 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
              <Heart size={20} color={ACCENT_COLORS.coral} />
            </View>
            
            <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.activityItem}>
                <View style={[styles.activityDot, { backgroundColor: ACCENT_COLORS.neonGreen }]} />
                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  Earned <Text style={{ color: ACCENT_COLORS.neonGreen, fontWeight: '600' as const }}>$25</Text> from referral bonus
                </Text>
                <Text style={[styles.activityTime, { color: colors.textTertiary }]}>2h ago</Text>
              </View>
              <View style={styles.activityItem}>
                <View style={[styles.activityDot, { backgroundColor: ACCENT_COLORS.gold }]} />
                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  Completed <Text style={{ color: ACCENT_COLORS.gold, fontWeight: '600' as const }}>VA Task</Text>
                </Text>
                <Text style={[styles.activityTime, { color: colors.textTertiary }]}>5h ago</Text>
              </View>
              <View style={styles.activityItem}>
                <View style={[styles.activityDot, { backgroundColor: ACCENT_COLORS.blue }]} />
                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  Received <Text style={{ color: ACCENT_COLORS.coral, fontWeight: '600' as const }}>5-star</Text> review
                </Text>
                <Text style={[styles.activityTime, { color: colors.textTertiary }]}>1d ago</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
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
});
