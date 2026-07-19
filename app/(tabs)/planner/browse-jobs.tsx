import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Briefcase,
  Car,
  Users,
  Package,
  Truck,
  HelpCircle,
  MapPin,
  Clock,
  DollarSign,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface JobRequest {
  id: string;
  user_id: string;
  type: string;
  status: string;
  title: string | null;
  description: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  payment_method: string | null;
  hours: string | null;
  tasks: any;
  notes: string | null;
  created_at: string;
  poster_name?: string;
}

const JOB_TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  chauffeur: { icon: Car, color: '#0EA5E9', label: 'Chauffeur' },
  va: { icon: Users, color: '#8B5CF6', label: 'Virtual Assistant' },
  driver: { icon: Truck, color: '#EC4899', label: 'Delivery' },
  errands: { icon: Package, color: '#F59E0B', label: 'Errands' },
  other: { icon: HelpCircle, color: '#6B7280', label: 'Other' },
};

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BrowseJobsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [addingToPlanner, setAddingToPlanner] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ['availableJobs'],
    queryFn: async () => {
      console.log('[BrowseJobs] Fetching available job requests...');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('job_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[BrowseJobs] Error fetching jobs:', error);
        return [];
      }

      const jobs = (data || []).filter(job => job.user_id !== user?.id);
      console.log('[BrowseJobs] Found', jobs.length, 'available jobs');
      return jobs as JobRequest[];
    },
    staleTime: 1000 * 30,
  });

  const acceptJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      console.log('[BrowseJobs] Accepting job:', jobId);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Not logged in');
      }

      const job = jobsQuery.data?.find(j => j.id === jobId);
      if (!job) throw new Error('Job not found');

      const { error: updateError } = await supabase
        .from('job_requests')
        .update({ 
          status: 'accepted',
        })
        .eq('id', jobId);

      if (updateError) {
        console.error('[BrowseJobs] Error accepting job:', updateError);
        throw updateError;
      }

      const planDate = job.tasks?.date || new Date().toISOString().split('T')[0];
      const planPayload = {
        user_id: user.id,
        date: planDate,
        date_label: `${JOB_TYPE_CONFIG[job.type]?.label || 'Job'} - Accepted`,
        location_type: 'coworking',
        transport: job.type === 'chauffeur' ? 'chauffeur' : 'none',
        plan: {
          location_type: 'coworking',
          transport: job.type === 'chauffeur' ? 'chauffeur' : 'none',
          assistance: [job.type],
          payment: job.payment_method || 'cash',
          imported_job: {
            id: job.id,
            type: job.type,
            title: job.title,
            description: job.description,
            pickup_location: job.pickup_location,
            dropoff_location: job.dropoff_location,
            pickup_time: job.pickup_time,
            hours: job.hours,
          },
        },
        status: 'active',
      };

      console.log('[BrowseJobs] Creating plan for accepted job:', planPayload);

      const { data: planData, error: planError } = await supabase
        .from('plans')
        .insert(planPayload)
        .select()
        .single();

      if (planError) {
        console.error('[BrowseJobs] Error creating plan:', planError);
      } else {
        console.log('[BrowseJobs] Plan created:', planData);
      }

      return { job, plan: planData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableJobs'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const { mutateAsync: acceptJob } = acceptJobMutation;

  const handleAcceptJob = useCallback(async (jobId: string) => {
    setSelectedJobId(jobId);
    setAddingToPlanner(true);

    try {
      await acceptJob(jobId);
      
      if (Platform.OS === 'web') {
        alert('Job accepted and added to your planner!');
      } else {
        Alert.alert('Success', 'Job accepted and added to your planner!', [
          { text: 'View Planner', onPress: () => router.back() },
          { text: 'Continue Browsing', style: 'cancel' },
        ]);
      }
    } catch (e: any) {
      console.error('[BrowseJobs] Accept job error:', e);
      if (Platform.OS === 'web') {
        alert('Failed to accept job: ' + e.message);
      } else {
        Alert.alert('Error', 'Failed to accept job: ' + e.message);
      }
    } finally {
      setAddingToPlanner(false);
      setSelectedJobId(null);
    }
  }, [acceptJob, router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queryClient.invalidateQueries({ queryKey: ['availableJobs'] });
    setTimeout(() => setRefreshing(false), 800);
  }, [queryClient]);

  const renderJobCard = (job: JobRequest) => {
    const config = JOB_TYPE_CONFIG[job.type] || JOB_TYPE_CONFIG.other;
    const Icon = config.icon;
    const isSelected = selectedJobId === job.id;

    return (
      <TouchableOpacity
        key={job.id}
        style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          setSelectedJobId(isSelected ? null : job.id);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.jobTypeBar, { backgroundColor: config.color }]} />
        
        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            <View style={[styles.jobTypeBadge, { backgroundColor: config.color + '20' }]}>
              <Icon size={14} color={config.color} />
              <Text style={[styles.jobTypeText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={[styles.jobTime, { color: colors.textTertiary }]}>
              {formatTimeAgo(job.created_at)}
            </Text>
          </View>

          <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>
            {job.title || `${config.label} Request`}
          </Text>

          {job.description && (
            <Text style={[styles.jobDescription, { color: colors.textSecondary }]} numberOfLines={2}>
              {job.description}
            </Text>
          )}

          <View style={styles.jobMeta}>
            {job.pickup_location && (
              <View style={styles.metaRow}>
                <MapPin size={12} color={colors.textTertiary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {job.pickup_location}
                </Text>
              </View>
            )}
            {job.pickup_time && (
              <View style={styles.metaRow}>
                <Clock size={12} color={colors.textTertiary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {job.pickup_time}
                </Text>
              </View>
            )}
            {job.hours && (
              <View style={styles.metaRow}>
                <Clock size={12} color={colors.textTertiary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {job.hours} hours
                </Text>
              </View>
            )}
            {job.payment_method && (
              <View style={styles.metaRow}>
                <DollarSign size={12} color={colors.textTertiary} />
                <Text style={[styles.metaText, { color: colors.textSecondary, textTransform: 'capitalize' }]}>
                  {job.payment_method}
                </Text>
              </View>
            )}
          </View>

          {isSelected && (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptJob(job.id)}
              disabled={addingToPlanner}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.acceptGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {addingToPlanner ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#FFF" />
                    <Text style={styles.acceptText}>Accept & Add to Planner</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <ChevronRight 
          size={20} 
          color={colors.textTertiary} 
          style={[styles.chevron, isSelected && { transform: [{ rotate: '90deg' }] }]} 
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Browse Jobs',
          headerLargeTitle: false,
        }}
      />

      <View style={[styles.headerBanner, { borderBottomColor: colors.border }]}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.bannerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Briefcase size={24} color="#FFF" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Available Gigs</Text>
            <Text style={styles.bannerSubtitle}>
              Accept jobs and add them to your planner
            </Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {jobsQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading available jobs...
            </Text>
          </View>
        ) : (jobsQuery.data?.length || 0) === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Briefcase size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No jobs available</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Check back later for new opportunities
            </Text>
          </View>
        ) : (
          <View style={styles.jobsList}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {jobsQuery.data?.length} job{(jobsQuery.data?.length || 0) > 1 ? 's' : ''} available
            </Text>
            {jobsQuery.data?.map(renderJobCard)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  loadingState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  jobsList: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  jobCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  jobTypeBar: {
    width: 4,
  },
  jobContent: {
    flex: 1,
    padding: 14,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  jobTypeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  jobTime: {
    fontSize: 11,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  jobDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  jobMeta: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    flex: 1,
  },
  acceptButton: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  chevron: {
    alignSelf: 'center',
    marginRight: 12,
  },
});
