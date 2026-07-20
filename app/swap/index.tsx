import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  Search,
  X,
  ArrowRight,
  Handshake,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCcw,
  Bookmark,
  Sparkles,
  DollarSign,
  ArrowLeftRight,
  ChevronRight,
  Clock,
  User,
  Car,
  Lock,
  MapPin,
  Eye,
  UserCheck,
  MessageCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useSwap, type OfferPaymentMethod, type SwapMatch, type SwapPost } from '@/contexts/SwapContext';
import { supabase } from '@/lib/supabase';

import { useAuth } from '@/contexts/AuthContext';


import ReviewModal, { type ReviewDraft } from '@/components/ReviewModal';
import { useLifeCrm } from '@/contexts/LifeCrmContext';
import { useTabBar } from '@/contexts/TabBarContext';


type Segment = 'browse' | 'mine' | 'saved';

type ActiveGigRow = {
  id: string;
  status: string;
  title?: string | null;
  request_title?: string | null;
  gig_title?: string | null;
  listing_title?: string | null;
  created_at?: string | null;
  taken_at?: string | null;
  request_id?: string | null;
  worker_id?: string | null;
  client_id?: string | null;
};
type PostType = 'swap' | 'paid';

type CreateForm = {
  type: PostType;
  title: string;
  offering: string;
  needing: string;
  category: string;
  price: string;
  isNegotiable: boolean;
  selectedSkillTemplate: string | null;
  vaSkills: string[];
  needCash: boolean;
  cashPrice: string;
};

const VA_SKILL_OPTIONS = [
  { id: 'calls', label: 'Calls / Follow-ups' },
  { id: 'scheduling', label: 'Scheduling / Calendar' },
  { id: 'content', label: 'Content Posting' },
  { id: 'research', label: 'Research / Data Entry' },
  { id: 'support', label: 'Customer Support' },
  { id: 'admin', label: 'Admin / Email' },
  { id: 'social', label: 'Social Media Management' },
  { id: 'bookkeeping', label: 'Basic Bookkeeping' },
  { id: 'travel', label: 'Travel Arrangements' },
  { id: 'other', label: 'Other' },
] as const;

const CATEGORIES = [
  { id: 'creative', label: 'Creative', color: '#7B61FF' },
  { id: 'tech', label: 'Tech', color: '#4ECDC4' },
  { id: 'home', label: 'Home', color: '#FF6B6B' },
  { id: 'errands', label: 'Errands', color: '#FFB300' },
  { id: 'fitness', label: 'Fitness', color: '#2ED573' },
  { id: 'business', label: 'Business', color: '#5D6DFF' },
] as const;

const SKILL_TEMPLATES = [
  { 
    id: 'chauffeur', 
    label: 'Chauffeur', 
    icon: 'car',
    color: '#4ECDC4',
    title: 'Chauffeur / Driver Services',
    offering: 'Professional driving services - airport transfers, errands, events, etc.',
    category: 'errands',
    negotiable: true,
  },
  { 
    id: 'virtual-assistant', 
    label: 'Virtual Assistant', 
    icon: 'user-check',
    color: '#7B61FF',
    title: 'Virtual Assistant Services',
    offering: 'Admin support, scheduling, research, data entry, email management, and more.',
    category: 'business',
    negotiable: true,
  },
] as const;

const defaultCreateForm: CreateForm = {
  type: 'swap',
  title: '',
  offering: '',
  needing: '',
  category: 'creative',
  price: '',
  isNegotiable: false,
  selectedSkillTemplate: null,
  vaSkills: [],
  needCash: false,
  cashPrice: '',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type SwapPrefillParams = {
  openCreate?: string;
  mode?: 'swap' | 'paid';
  title?: string;
  offering?: string;
  needing?: string;
  category?: string;
  price?: string;
  from?: string;
};

export default function SwapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const prefillParams = useLocalSearchParams<SwapPrefillParams>();
  const didHandlePrefillRef = useRef<boolean>(false);
  
  const { addBill } = useLifeCrm();

  const { user } = useAuth();

  const {
    isLoading,
    createPost,
    deletePost,
    closePost,
    proposeSwap,
    acceptMatch,
    declineMatch,
    cancelMatch,
    getMyPosts,
    getOpenPosts,
    getMyMatches,
    getSavedPosts,
    getPostById,
    toggleSavePost,
    isPostSaved,
    clearAll,
  } = useSwap();

  const [segment, setSegment] = useState<Segment>('browse');
  const [search, setSearch] = useState<string>('');
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreateForm);

  const [showPropose, setShowPropose] = useState<boolean>(false);
  const [targetPostId, setTargetPostId] = useState<string | null>(null);
  const [selectedMyPostId, setSelectedMyPostId] = useState<string | null>(null);

  const [showMatches, setShowMatches] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isCompletingGig, setIsCompletingGig] = useState<boolean>(false);
  const [isClosingGig, setIsClosingGig] = useState<boolean>(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const openReview = useCallback(
    (draft: ReviewDraft) => {
      console.log('[SwapScreen] Opening review modal:', draft);
      setReviewDraft(draft);
      setIsReviewModalVisible(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    []
  );

  const submitReview = useCallback(
    async (payload: { rating: number; text: string }) => {
      if (!reviewDraft) return;

      try {
        setIsSubmittingReview(true);

        const reviewerId = reviewDraft.reviewerId;
        const revieweeId = reviewDraft.revieweeId;
        const requestId = reviewDraft.requestId;

        console.log('[SwapScreen] Inserting review into Supabase:', {
          requestId,
          reviewerId,
          revieweeId,
          rating: payload.rating,
        });

        const { data, error } = await supabase
          .from('reviews')
          .insert({
            request_id: requestId,
            reviewer_id: reviewerId,
            reviewee_id: revieweeId,
            rating: payload.rating,
            text: payload.text,
          })
          .select('*')
          .maybeSingle();

        if (error) {
          console.error('[SwapScreen] Review insert error:', error);
          showToast('Could not submit rating. Try again.', 'error');
          return;
        }

        console.log('[SwapScreen] Review insert success:', data);
        showToast('Thanks! Rating submitted.', 'success');
        setIsReviewModalVisible(false);
        setReviewDraft(null);
      } catch (e) {
        console.error('[SwapScreen] Review submit exception:', e);
        showToast('Could not submit rating. Try again.', 'error');
      } finally {
        setIsSubmittingReview(false);
      }
    },
    [reviewDraft, showToast]
  );

  const applyPrefill = useCallback(
    (p: SwapPrefillParams) => {
      const mode: PostType = p.mode === 'paid' ? 'paid' : 'swap';
      const nextCategory = p.category && CATEGORIES.find(c => c.id === p.category?.toLowerCase()) 
        ? p.category.toLowerCase() 
        : 'creative';

      const next: CreateForm = {
        type: mode,
        title: p.title ?? '',
        offering: p.offering ?? '',
        needing: p.needing ?? '',
        category: nextCategory,
        price: p.price ?? '',
        isNegotiable: false,
        selectedSkillTemplate: null,
        vaSkills: [],
        needCash: false,
        cashPrice: '',
      };

      console.log('[SwapScreen] applyPrefill', { from: p.from, mode, next });
      setCreateForm(next);
      setShowCreate(true);
    },
    [setCreateForm]
  );

  useEffect(() => {
    if (didHandlePrefillRef.current) return;
    const openCreate = prefillParams.openCreate;
    if (openCreate !== '1') return;
    didHandlePrefillRef.current = true;
    applyPrefill(prefillParams);
  }, [applyPrefill, prefillParams]);

  const activeGigsQuery = useQuery({
    queryKey: ['my_active_gigs', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ActiveGigRow[]> => {
      console.log('[SwapScreen] Fetching active gigs from my_active_gigs view...', { userId: user?.id });

      const { data, error } = await supabase
        .from('my_active_gigs')
        .select('*')
        .eq('status', 'taken');

      if (error) {
        const errAny = error as any;
        if (errAny?.name === 'AbortError' || errAny?.code === 'PGRST116') {
          console.log('[SwapScreen] Active gigs query aborted or table missing');
          return [];
        }
        console.error('[SwapScreen] Active gigs query error:', error);
        return [];
      }

      const rows = (Array.isArray(data) ? data : []) as ActiveGigRow[];
      console.log('[SwapScreen] Active gigs fetched:', { count: rows.length });
      return rows;
    },
    staleTime: 1000 * 60 * 2,
    retry: (failureCount, error: any) => error?.name !== 'AbortError' && failureCount < 1,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const { refetch: refetchActiveGigs } = activeGigsQuery;

  const onRefresh = useCallback(() => {
    console.log('[SwapScreen] Pull-to-refresh triggered');
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    refetchActiveGigs().catch((e) => {
      console.error('[SwapScreen] Active gigs refetch failed:', e);
    });

    setTimeout(() => setRefreshing(false), 900);
  }, [refetchActiveGigs]);

  const openPosts = useMemo(() => {
    const base = getOpenPosts();
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => {
      const blob = `${p.title} ${p.offering} ${p.needing} ${p.category}`.toLowerCase();
      return blob.includes(q);
    });
  }, [getOpenPosts, search]);

  const myPosts = useMemo(() => getMyPosts(), [getMyPosts]);
  const myOpenPosts = useMemo(() => myPosts.filter((p) => p.status === 'open'), [myPosts]);
  const savedPostsList = useMemo(() => getSavedPosts(), [getSavedPosts]);
  const myMatches = useMemo(() => getMyMatches(), [getMyMatches]);

  const pendingIncoming = useMemo(() => {
    return myMatches.filter((m) => m.status === 'pending' && m.targetUserId === 'current-user');
  }, [myMatches]);

  const accepted = useMemo(() => myMatches.filter((m) => m.status === 'accepted'), [myMatches]);

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const onOpenCreate = useCallback((type: PostType = 'swap') => {
    onPressHaptic();
    setCreateForm({ ...defaultCreateForm, type });
    setShowCreate(true);
  }, [onPressHaptic]);

  const canSubmit = useMemo(() => {
    if (createForm.selectedSkillTemplate === 'virtual-assistant' && createForm.vaSkills.length === 0) {
      return false;
    }
    if (createForm.type === 'paid') {
      return createForm.title.trim().length > 0 && createForm.offering.trim().length > 0;
    }
    const hasNeeding = createForm.needCash 
      ? createForm.cashPrice.trim().length > 0 
      : createForm.needing.trim().length > 0;
    return (
      createForm.title.trim().length > 0 &&
      createForm.offering.trim().length > 0 &&
      hasNeeding
    );
  }, [createForm]);

  const submitCreate = useCallback(() => {
    if (!canSubmit) {
      Alert.alert('Missing info', 'Please fill in the required fields.');
      return;
    }
    onPressHaptic();
    
    let offeringText = createForm.offering;
    if (createForm.selectedSkillTemplate === 'virtual-assistant' && createForm.vaSkills.length > 0) {
      const selectedSkillLabels = createForm.vaSkills.map(id => 
        VA_SKILL_OPTIONS.find(s => s.id === id)?.label || id
      );
      offeringText = `${createForm.offering}\n\nSkills: ${selectedSkillLabels.join(', ')}`;
    }
    
    const needingText = createForm.needCash 
      ? `Cash: ${createForm.cashPrice}` 
      : createForm.needing;
    
    createPost({
      title: createForm.title,
      details: '',
      offering: offeringText,
      needing: createForm.type === 'paid' ? 'Payment' : needingText,
      category: CATEGORIES.find(c => c.id === createForm.category)?.label || 'Creative',
      price: createForm.type === 'paid' && createForm.price ? parseFloat(createForm.price) : (createForm.needCash && createForm.cashPrice ? parseFloat(createForm.cashPrice) : undefined),
    });
    setShowCreate(false);
    setSegment('mine');
  }, [canSubmit, createForm, createPost, onPressHaptic]);

  const [proposalPaymentMethod, setProposalPaymentMethod] = useState<OfferPaymentMethod>('swap');

  const openPropose = useCallback(
    (postId: string) => {
      onPressHaptic();
      setTargetPostId(postId);
      setSelectedMyPostId(myOpenPosts[0]?.id ?? null);
      setProposalPaymentMethod('swap');
      setShowPropose(true);
    },
    [myOpenPosts, onPressHaptic]
  );

  const submitPropose = useCallback(() => {
    if (!targetPostId || !selectedMyPostId) {
      Alert.alert('Select a post', 'Choose one of your open posts to propose a swap.');
      return;
    }
    onPressHaptic();
    proposeSwap(selectedMyPostId, targetPostId, undefined, proposalPaymentMethod);

    supabase
      .from('offers')
      .insert({
        request_id: targetPostId,
        payment_method: proposalPaymentMethod,
      })
      .select('id')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[SwapScreen] offers insert failed (non-blocking):', error);
          return;
        }
        console.log('[SwapScreen] offers insert success (non-blocking):', data);
      });
    
    setShowPropose(false);
    setShowMatches(true);
  }, [onPressHaptic, proposeSwap, selectedMyPostId, targetPostId, proposalPaymentMethod]);

  const confirmDeletePost = useCallback(
    (postId: string) => {
      Alert.alert('Delete post?', 'This will remove the post and any related proposals.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onPressHaptic();
            deletePost(postId);
          },
        },
      ]);
    },
    [deletePost, onPressHaptic]
  );

  const confirmClosePost = useCallback(
    (postId: string) => {
      Alert.alert('Mark as complete?', 'This will close your listing.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: () => {
            onPressHaptic();
            closePost(postId);
          },
        },
      ]);
    },
    [closePost, onPressHaptic]
  );

  const handleCloseGig = useCallback(
    async (postId: string) => {
      Alert.alert(
        'Close Gig',
        'This will close the gig and stop accepting new proposals. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Close Gig',
            style: 'destructive',
            onPress: async () => {
              onPressHaptic();
              setIsClosingGig(true);

              try {
                console.log('[SwapScreen] Closing gig:', postId);

                const { error } = await supabase
                  .from('service_requests')
                  .update({ status: 'closed' })
                  .eq('id', postId);

                if (error) {
                  console.error('[SwapScreen] Error closing gig in database:', error);
                }

                closePost(postId);
                showToast('Gig closed. No more proposals allowed.', 'success');
              } catch (error) {
                console.error('[SwapScreen] Error closing gig:', error);
                showToast('Failed to close gig. Try again.', 'error');
              } finally {
                setIsClosingGig(false);
              }
            },
          },
        ]
      );
    },
    [closePost, onPressHaptic, showToast]
  );

  const getPaymentToastMessage = useCallback((method: OfferPaymentMethod | undefined) => {
    const m: OfferPaymentMethod = method ?? 'cash';
    if (m === 'stripe') return 'Paid via Stripe';
    if (m === 'apple_pay') return 'Paid via Apple Pay';
    if (m === 'cash') return 'Cash settled.';
    return 'Swap completed.';
  }, []);

  const handleCompleteGig = useCallback(
    async (postId: string, acceptedOffers: SwapMatch[]) => {
      if (acceptedOffers.length === 0) {
        Alert.alert('No Workers', 'There are no accepted workers to complete the gig for.');
        return;
      }

      Alert.alert(
        'Complete Gig',
        `This will mark the gig as complete for ${acceptedOffers.length} worker${acceptedOffers.length > 1 ? 's' : ''}. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            style: 'default',
            onPress: async () => {
              onPressHaptic();
              setIsCompletingGig(true);

              try {
                const { data: { session } } = await supabase.auth.getSession();
                const authToken = session?.access_token;
                console.log('[SwapScreen] Complete gig auth token exists:', !!authToken);

                console.log('[SwapScreen] Completing gig for post:', postId);
                console.log('[SwapScreen] Accepted offers:', acceptedOffers.length);

                const results = await Promise.allSettled(
                  acceptedOffers.map(async (offer) => {
                    const method: OfferPaymentMethod = offer.paymentMethod ?? 'cash';

                    console.log('[SwapScreen] Completing gig worker:', {
                      requestId: postId,
                      workerId: offer.proposerUserId,
                      paymentMethod: method,
                    });

                    if (method === 'cash' || method === 'swap') {
                      return { skipped: true, paymentMethod: method } as const;
                    }

                    const { data, error } = await supabase.rpc('complete_gig', {
                      request_id: postId,
                      worker_id: offer.proposerUserId,
                    });

                    if (error) {
                      console.error('[SwapScreen] complete_gig error:', error);
                      throw error;
                    }

                    return { data, paymentMethod: method } as const;
                  })
                );

                const succeeded = results.filter((r) => r.status === 'fulfilled').length;
                const failed = results.filter((r) => r.status === 'rejected').length;

                console.log('[SwapScreen] complete_gig settled:', { succeeded, failed });

                if (failed > 0) {
                  console.warn('[SwapScreen] Some complete_gig calls failed:', failed);
                }

                closePost(postId);

                if (failed > 0) {
                  showToast('Payment failed, try again later.', 'error');
                } else {
                  const uniqueMethods = Array.from(
                    new Set(acceptedOffers.map((o) => (o.paymentMethod ?? 'cash') as OfferPaymentMethod))
                  );

                  if (uniqueMethods.length === 1) {
                    showToast(getPaymentToastMessage(uniqueMethods[0]), 'success');
                  } else {
                    showToast('Payments processed. Check each worker for details.', 'success');
                  }
                }
              } catch (error) {
                console.error('[SwapScreen] Error completing gig:', error);
                showToast('Payment failed, try again later.', 'error');
              } finally {
                setIsCompletingGig(false);
              }
            },
          },
        ]
      );
    },
    [closePost, getPaymentToastMessage, onPressHaptic, showToast]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="swapScreen">
      <ReviewModal
        visible={isReviewModalVisible}
        onClose={() => {
          setIsReviewModalVisible(false);
          setReviewDraft(null);
        }}
        colors={colors}
        draft={reviewDraft}
        onSubmit={submitReview}
        isSubmitting={isSubmittingReview}
      />
      {toast.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              backgroundColor: toast.type === 'success' ? '#2ED573' : '#FF6B6B',
              top: insets.top + 10,
            },
          ]}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} color="#fff" />
          ) : (
            <XCircle size={18} color="#fff" />
          )}
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <LinearGradient
                colors={['#2ED573', '#26B86A']}
                style={styles.logoIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Handshake size={18} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Skills & Services</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => {
                  onPressHaptic();
                  setShowMatches(true);
                }}
                style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                testID="swapOpenMatches"
              >
                <ArrowLeftRight size={20} color={colors.text} />
                {pendingIncoming.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingIncoming.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          testID="swapScroll"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          <View style={styles.actionCardsSection}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onOpenCreate('swap')}
              style={styles.actionCardWrapper}
            >
              <LinearGradient
                colors={['#2ED573', '#26B86A']}
                style={styles.actionCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.actionCardContent}>
                  <Text style={styles.actionCardLabel}>SKILL SWAP</Text>
                  <Text style={styles.actionCardTitle}>Trade Your Skills</Text>
                  <Text style={styles.actionCardSubtitle}>Exchange services, no money needed</Text>
                </View>
                <View style={styles.actionCardIcon}>
                  <ArrowLeftRight size={36} color="rgba(255,255,255,0.4)" />
                </View>
                <View style={styles.actionCardArrow}>
                  <Plus size={20} color="#fff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>


          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{openPosts.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Available</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{myPosts.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>My Posts</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: '#2ED573' }]}>{accepted.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
            </View>
          </View>

          <View style={styles.segmentSection}>
            <View style={[styles.segmentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(['browse', 'mine', 'saved'] as Segment[]).map((seg) => (
                <TouchableOpacity
                  key={seg}
                  onPress={() => {
                    onPressHaptic();
                    setSegment(seg);
                  }}
                  style={[
                    styles.segmentPill,
                    segment === seg && styles.segmentPillActive,
                    segment === seg && { backgroundColor: colors.text },
                  ]}
                >
                  {seg === 'saved' && <Bookmark size={14} color={segment === seg ? colors.background : colors.textSecondary} />}
                  <Text style={[
                    styles.segmentText,
                    { color: segment === seg ? colors.background : colors.textSecondary },
                  ]}>
                    {seg === 'browse' ? 'Browse' : seg === 'mine' ? 'My Posts' : savedPostsList.length > 0 ? `${savedPostsList.length}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {(segment === 'browse' || segment === 'saved') && (
            <View style={styles.searchSection}>
              <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search skills, services..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={styles.listSection}>
            {segment === 'browse' && (
              <>
                {isLoading ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Loading…</Text>
                  </View>
                ) : openPosts.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Sparkles size={32} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No listings yet</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Be the first to post your skills</Text>
                  </View>
                ) : (
                  openPosts.map((p) => (
                    <ServiceCard
                      key={p.id}
                      post={p}
                      colors={colors}
                      canPropose={p.status === 'open'}
                      isSaved={isPostSaved(p.id)}
                      onPressPropose={() => openPropose(p.id)}
                      onPressSave={() => {
                        onPressHaptic();
                        toggleSavePost(p.id);
                      }}
                    />
                  ))
                )}
              </>
            )}

            {segment === 'saved' && (
              <>
                {savedPostsList.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Bookmark size={32} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved posts</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bookmark posts you&apos;re interested in</Text>
                  </View>
                ) : (
                  savedPostsList.map((p) => (
                    <ServiceCard
                      key={p.id}
                      post={p}
                      colors={colors}
                      canPropose={p.status === 'open'}
                      isSaved={true}
                      onPressPropose={() => openPropose(p.id)}
                      onPressSave={() => {
                        onPressHaptic();
                        toggleSavePost(p.id);
                      }}
                    />
                  ))
                )}
              </>
            )}

            {segment === 'mine' && (
              <>
                <View style={styles.mineHeader}>
                  <Text style={[styles.mineHeaderText, { color: colors.textSecondary }]}>Your listings</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Reset data?', 'This restores demo data.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reset', style: 'destructive', onPress: () => { onPressHaptic(); clearAll(); } },
                      ]);
                    }}
                  >
                    <RefreshCcw size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.sectionBlock} testID="activeGigsSection">
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Gigs</Text>
                      <View style={[styles.sectionPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionPillText, { color: colors.textSecondary }]}>
                          {activeGigsQuery.isLoading ? '…' : `${activeGigsQuery.data?.length ?? 0}`}
                        </Text>
                      </View>
                    </View>
                    {activeGigsQuery.isError && (
                      <TouchableOpacity
                        onPress={() => activeGigsQuery.refetch()}
                        style={[styles.retryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        testID="activeGigsRetry"
                      >
                        <Text style={[styles.retryChipText, { color: colors.textSecondary }]}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {activeGigsQuery.isLoading ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      testID="activeGigsLoading"
                    >
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>Loading…</Text>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Fetching your active gigs</Text>
                    </View>
                  ) : (activeGigsQuery.data?.length ?? 0) === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      testID="activeGigsEmpty"
                    >
                      <Handshake size={32} color={colors.textTertiary} />
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>Zero active</Text>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Gigs you’ve taken (status: taken) will appear here</Text>
                    </View>
                  ) : (
                    <View style={styles.activeGigList} testID="activeGigsList">
                      {(activeGigsQuery.data ?? []).map((g) => {
                        const title =
                          g.title ??
                          g.request_title ??
                          g.gig_title ??
                          g.listing_title ??
                          'Active gig';
                        const when = g.taken_at ?? g.created_at;
                        return (
                          <View
                            key={g.id}
                            style={[styles.activeGigCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            testID={`activeGig_${g.id}`}
                          >
                            <View style={styles.activeGigTopRow}>
                              <View style={[styles.activeGigIcon, { backgroundColor: '#2ED57320' }]}>
                                <CheckCircle2 size={16} color="#2ED573" />
                              </View>
                              <View style={styles.activeGigTitleWrap}>
                                <Text style={[styles.activeGigTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
                                <View style={styles.activeGigMetaRow}>
                                  <View style={[styles.statusPill, { backgroundColor: '#2ED57315' }]}>
                                    <Text style={[styles.statusPillText, { color: '#2ED573' }]}>taken</Text>
                                  </View>
                                  {when ? (
                                    <>
                                      <View style={styles.serviceDot} />
                                      <Text style={[styles.activeGigMetaText, { color: colors.textTertiary }]} numberOfLines={1}>
                                        {formatTime(when)}
                                      </Text>
                                    </>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {myPosts.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Plus size={32} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No posts yet</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Create your first listing above</Text>
                  </View>
                ) : (
                  myPosts.map((p) => {
                    const postProposals = myMatches.filter(
                      (m) => m.targetPostId === p.id && m.status === 'pending' && m.targetUserId === 'current-user'
                    );
                    const postAcceptedOffers = myMatches.filter(
                      (m) => m.targetPostId === p.id && m.status === 'accepted' && m.targetUserId === 'current-user'
                    );
                    return (
                      <MyServiceCard
                        key={p.id}
                        post={p}
                        colors={colors}
                        onPressClose={() => confirmClosePost(p.id)}
                        onPressDelete={() => confirmDeletePost(p.id)}
                        proposals={postProposals}
                        acceptedOffers={postAcceptedOffers}
                        onAcceptProposal={acceptMatch}
                        onDeclineProposal={declineMatch}
                        onCompleteGig={handleCompleteGig}
                        onCloseGig={handleCloseGig}
                        getPostById={getPostById}
                        isCompletingGig={isCompletingGig}
                        isClosingGig={isClosingGig}
                        onOpenReview={openReview}
                        currentUserId={user?.id ?? 'current-user'}
                      />
                    );
                  })
                )}
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        colors={colors}
        form={createForm}
        setForm={setCreateForm}
        canSubmit={canSubmit}
        onSubmit={submitCreate}
      />

      <ProposeSwapModal
        visible={showPropose}
        onClose={() => setShowPropose(false)}
        colors={colors}
        myOpenPosts={myOpenPosts}
        targetPost={targetPostId ? getPostById(targetPostId) : undefined}
        selectedMyPostId={selectedMyPostId}
        setSelectedMyPostId={setSelectedMyPostId}
        paymentMethod={proposalPaymentMethod}
        setPaymentMethod={setProposalPaymentMethod}
        onSubmit={submitPropose}
        onSubmitCash={(amount) => {
          if (!targetPostId) return;
          onPressHaptic();
          proposeSwap('', targetPostId, amount, proposalPaymentMethod);

          supabase
            .from('offers')
            .insert({
              request_id: targetPostId,
              payment_method: proposalPaymentMethod,
              cash_offer: amount,
            })
            .select('id')
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) {
                console.error('[SwapScreen] offers insert failed (non-blocking):', error);
                return;
              }
              console.log('[SwapScreen] offers insert success (non-blocking):', data);
            });
          
          setShowPropose(false);
          setShowMatches(true);
        }}
      />

      <MatchesModal
        visible={showMatches}
        onClose={() => setShowMatches(false)}
        colors={colors}
        matches={myMatches}
        getPostById={getPostById}
        onOpenReview={openReview}
        currentUserId={user?.id ?? 'current-user'}
        onAccept={(matchId) => {
          acceptMatch(matchId);
          const match = getMyMatches().find(m => m.id === matchId);
          if (match) {
            const isProposer = match.proposerUserId === 'current-user';
            const otherPostId = isProposer ? match.targetPostId : match.proposerPostId;
            const myPostId = isProposer ? match.proposerPostId : match.targetPostId;
            const otherPost = getPostById(otherPostId);
            const myPost = getPostById(myPostId);
            if (otherPost && myPost) {
              // Note: Track swaps via Planner tab
              if (otherPost.price && otherPost.price > 0) {
                addBill({
                  name: `Service: ${otherPost.title}`,
                  amount: otherPost.price,
                  dueDate: new Date().toISOString(),
                  category: 'other',
                  isPaid: false,
                  isRecurring: false,
                });
              }
              Alert.alert('Swap Accepted!', 'Added to your planner.');
            }
          }
        }}
        onDecline={declineMatch}
        onCancel={cancelMatch}
      />
    </View>
  );
}

function ServiceCard({
  post,
  colors,
  canPropose,
  isSaved,
  onPressPropose,
  onPressSave,
}: {
  post: SwapPost;
  colors: any;
  canPropose: boolean;
  isSaved: boolean;
  onPressPropose: () => void;
  onPressSave: () => void;
}) {
  const categoryColor = CATEGORIES.find(c => c.label === post.category)?.color || '#7B61FF';
  const isPaid = post.price && post.price > 0;
  const isChauffeurRequest = post.isServiceRequest && post.title.toLowerCase().includes('chauffeur');
  const hasPrivateDetails = !!post.privateDetails;

  return (
    <View style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: isChauffeurRequest ? '#4ECDC4' : colors.border }]}>
      {isChauffeurRequest && (
        <View style={[styles.serviceRequestBanner, { backgroundColor: '#4ECDC420' }]}>
          <Car size={14} color="#4ECDC4" />
          <Text style={[styles.serviceRequestBannerText, { color: '#4ECDC4' }]}>Chauffeur Request</Text>
          {hasPrivateDetails && (
            <View style={styles.privacyBadge}>
              <Lock size={10} color="#4ECDC4" />
              <Text style={[styles.privacyBadgeText, { color: '#4ECDC4' }]}>Private address</Text>
            </View>
          )}
        </View>
      )}
      
      <View style={styles.serviceCardHeader}>
        <View style={[styles.serviceAvatar, { backgroundColor: isChauffeurRequest ? '#4ECDC420' : categoryColor + '20' }]}>
          {isChauffeurRequest ? (
            <Car size={18} color="#4ECDC4" />
          ) : (
            <Text style={[styles.serviceAvatarText, { color: categoryColor }]}>
              {(post.author?.name?.[0] ?? 'U').toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.serviceHeaderInfo}>
          <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={2}>{post.title}</Text>
          <View style={styles.serviceMetaRow}>
            <Text style={[styles.serviceAuthor, { color: colors.textSecondary }]}>{post.author?.name ?? 'User'}</Text>
            <View style={styles.serviceDot} />
            <Text style={[styles.serviceTime, { color: colors.textTertiary }]}>{formatTime(post.createdAt)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onPressSave} style={styles.saveBtn}>
          <Bookmark size={20} color={isSaved ? '#FF6B6B' : colors.textTertiary} fill={isSaved ? '#FF6B6B' : 'transparent'} />
        </TouchableOpacity>
      </View>

      {isChauffeurRequest && post.location ? (
        <View style={[styles.chauffeurLocationRow, { backgroundColor: colors.background }]}>
          <View style={styles.chauffeurLocationItem}>
            <MapPin size={14} color="#4ECDC4" />
            <View>
              <Text style={[styles.chauffeurLocationLabel, { color: colors.textTertiary }]}>PICKUP AREA</Text>
              <Text style={[styles.chauffeurLocationValue, { color: colors.text }]}>
                {post.location.split('→')[0]?.trim() || 'ZIP provided'}
              </Text>
            </View>
          </View>
          <ArrowRight size={14} color={colors.textSecondary} />
          <View style={styles.chauffeurLocationItem}>
            <MapPin size={14} color="#FF6B6B" />
            <View>
              <Text style={[styles.chauffeurLocationLabel, { color: colors.textTertiary }]}>DESTINATION AREA</Text>
              <Text style={[styles.chauffeurLocationValue, { color: colors.text }]}>
                {post.location.split('→')[1]?.trim() || 'ZIP provided'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.serviceSwapRow}>
          <View style={[styles.serviceSwapBlock, { backgroundColor: colors.background }]}>
            <Text style={[styles.serviceSwapLabel, { color: colors.textTertiary }]}>OFFERING</Text>
            <Text style={[styles.serviceSwapValue, { color: colors.text }]} numberOfLines={2}>{post.offering}</Text>
          </View>
          <View style={styles.serviceSwapArrow}>
            <ArrowRight size={16} color={colors.textSecondary} />
          </View>
          <View style={[styles.serviceSwapBlock, { backgroundColor: colors.background }]}>
            <Text style={[styles.serviceSwapLabel, { color: colors.textTertiary }]}>
              {isPaid ? 'PRICE' : 'LOOKING FOR'}
            </Text>
            <Text style={[styles.serviceSwapValue, { color: isPaid ? '#2ED573' : colors.text }]} numberOfLines={2}>
              {isPaid ? `${post.price}` : post.needing}
            </Text>
          </View>
        </View>
      )}

      {hasPrivateDetails && isChauffeurRequest && (
        <View style={[styles.addressPrivacyNote, { backgroundColor: colors.background }]}>
          <Eye size={12} color={colors.textTertiary} />
          <Text style={[styles.addressPrivacyText, { color: colors.textSecondary }]}>
            Full address shared after you accept the job
          </Text>
        </View>
      )}

      <View style={styles.serviceFooter}>
        <View style={[styles.categoryTag, { backgroundColor: isChauffeurRequest ? '#4ECDC415' : categoryColor + '15' }]}>
          <Text style={[styles.categoryTagText, { color: isChauffeurRequest ? '#4ECDC4' : categoryColor }]}>{post.category}</Text>
        </View>
        <TouchableOpacity
          disabled={!canPropose}
          onPress={onPressPropose}
          style={[
            styles.proposeBtn,
            { backgroundColor: canPropose ? (isChauffeurRequest ? '#4ECDC4' : '#2ED573') : colors.border },
          ]}
        >
          <Text style={[styles.proposeBtnText, { color: canPropose ? '#fff' : colors.textSecondary }]}>
            {isChauffeurRequest ? 'Request Job' : isPaid ? 'Book' : 'Propose'}
          </Text>
          <ChevronRight size={16} color={canPropose ? '#fff' : colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MyServiceCard({
  post,
  colors,
  onPressClose,
  onPressDelete,
  proposals,
  acceptedOffers,
  onAcceptProposal,
  onDeclineProposal,
  onCompleteGig,
  onCloseGig,
  getPostById,
  isCompletingGig,
  isClosingGig,
  onOpenReview,
  currentUserId,
}: {
  post: SwapPost;
  colors: any;
  onPressClose: () => void;
  onPressDelete: () => void;
  proposals: any[];
  acceptedOffers: SwapMatch[];
  onAcceptProposal: (matchId: string) => void;
  onDeclineProposal: (matchId: string) => void;
  onCompleteGig: (postId: string, acceptedOffers: SwapMatch[]) => void;
  onCloseGig: (postId: string) => void;
  getPostById: (id: string) => SwapPost | undefined;
  isCompletingGig: boolean;
  isClosingGig: boolean;
  onOpenReview: (draft: ReviewDraft) => void;
  currentUserId: string;
}) {
  const statusColor = post.status === 'open' ? '#2ED573' : post.status === 'matched' ? '#7B61FF' : colors.textSecondary;
  const categoryColor = CATEGORIES.find(c => c.label === post.category)?.color || '#7B61FF';
  const isServiceRequest = post.isServiceRequest === true;
  const isChauffeurRequest = isServiceRequest && post.title.toLowerCase().includes('chauffeur');
  const isVARequest = isServiceRequest && (post.title.toLowerCase().includes('va help') || post.title.toLowerCase().includes('virtual assistant'));
  const isDriverRequest = isServiceRequest && post.title.toLowerCase().includes('driver');
  const isErrandsRequest = isServiceRequest && post.title.toLowerCase().includes('errands');

  const getRequestType = () => {
    if (isChauffeurRequest) return { label: 'Transportation Request', color: '#4ECDC4', icon: Car };
    if (isVARequest) return { label: 'VA Request', color: '#7B61FF', icon: UserCheck };
    if (isDriverRequest) return { label: 'Driver Request', color: '#4ECDC4', icon: Car };
    if (isErrandsRequest) return { label: 'Errands Request', color: '#FFB300', icon: Clock };
    if (isServiceRequest) return { label: 'Service Request', color: '#7B61FF', icon: Handshake };
    return null;
  };

  const requestType = getRequestType();

  return (
    <View style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: isServiceRequest ? (requestType?.color || '#7B61FF') : colors.border }]}>
      {isServiceRequest && requestType && (
        <View style={[styles.serviceRequestBanner, { backgroundColor: requestType.color + '20' }]}>
          <requestType.icon size={14} color={requestType.color} />
          <Text style={[styles.serviceRequestBannerText, { color: requestType.color }]}>{requestType.label}</Text>
          <View style={[styles.myRequestBadge, { backgroundColor: requestType.color }]}>
            <Text style={styles.myRequestBadgeText}>MY REQUEST</Text>
          </View>
        </View>
      )}
      
      <View style={styles.serviceCardHeader}>
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        <View style={styles.serviceHeaderInfo}>
          <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={2}>{post.title}</Text>
          <Text style={[styles.serviceStatus, { color: statusColor }]}>
            {post.status === 'open' ? 'Active' : post.status === 'matched' ? 'Matched' : 'Closed'}
          </Text>
        </View>
        <View style={[styles.categoryTag, { backgroundColor: categoryColor + '15' }]}>
          <Text style={[styles.categoryTagText, { color: categoryColor }]}>{post.category}</Text>
        </View>
      </View>

      {isChauffeurRequest && post.location ? (
        <View style={[styles.chauffeurLocationRow, { backgroundColor: colors.background }]}>
          <View style={styles.chauffeurLocationItem}>
            <MapPin size={14} color="#4ECDC4" />
            <View>
              <Text style={[styles.chauffeurLocationLabel, { color: colors.textTertiary }]}>FROM</Text>
              <Text style={[styles.chauffeurLocationValue, { color: colors.text }]}>
                {post.location.split('→')[0]?.trim() || 'ZIP provided'}
              </Text>
            </View>
          </View>
          <ArrowRight size={14} color={colors.textSecondary} />
          <View style={styles.chauffeurLocationItem}>
            <MapPin size={14} color="#FF6B6B" />
            <View>
              <Text style={[styles.chauffeurLocationLabel, { color: colors.textTertiary }]}>TO</Text>
              <Text style={[styles.chauffeurLocationValue, { color: colors.text }]}>
                {post.location.split('→')[1]?.trim() || 'ZIP provided'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.serviceSwapRow}>
          <View style={[styles.serviceSwapBlock, { backgroundColor: colors.background }]}>
            <Text style={[styles.serviceSwapLabel, { color: colors.textTertiary }]}>
              {isServiceRequest ? 'PAYMENT' : 'OFFERING'}
            </Text>
            <Text style={[styles.serviceSwapValue, { color: colors.text }]} numberOfLines={2}>{post.offering}</Text>
          </View>
          <View style={styles.serviceSwapArrow}>
            <ArrowRight size={16} color={colors.textSecondary} />
          </View>
          <View style={[styles.serviceSwapBlock, { backgroundColor: colors.background }]}>
            <Text style={[styles.serviceSwapLabel, { color: colors.textTertiary }]}>
              {isServiceRequest ? 'LOOKING FOR' : 'LOOKING FOR'}
            </Text>
            <Text style={[styles.serviceSwapValue, { color: colors.text }]} numberOfLines={2}>{post.needing}</Text>
          </View>
        </View>
      )}

      {isServiceRequest && post.timeEstimate && (
        <View style={[styles.requestTimeEstimate, { backgroundColor: colors.background }]}>
          <Clock size={12} color={colors.textTertiary} />
          <Text style={[styles.requestTimeEstimateText, { color: colors.textSecondary }]}>
            Estimated time: {post.timeEstimate}
          </Text>
        </View>
      )}

      {proposals.length > 0 && post.status === 'open' && (
        <View style={styles.proposalsSection}>
          <View style={styles.proposalsHeader}>
            <User size={14} color={colors.textSecondary} />
            <Text style={[styles.proposalsTitle, { color: colors.text }]}>
              {proposals.length} Proposal{proposals.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {proposals.map((match) => {
            const proposerPost = getPostById(match.proposerPostId);
            const isCashOffer = match.isCashOffer === true;
            return (
              <View key={match.id} style={[styles.proposalCard, { backgroundColor: colors.background, borderColor: isCashOffer ? '#FF6B6B' : colors.border }]}>
                <View style={styles.proposalInfo}>
                  {isCashOffer ? (
                    <>
                      <View style={[styles.proposalAvatar, { backgroundColor: '#FF6B6B20' }]}>
                        <DollarSign size={16} color="#FF6B6B" />
                      </View>
                      <View style={styles.proposalDetails}>
                        <Text style={[styles.proposalName, { color: '#FF6B6B' }]}>
                          ${match.cashOffer} Cash Offer
                        </Text>
                        <Text style={[styles.proposalMeta, { color: colors.textSecondary }]}>
                          Direct payment offer
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.proposalAvatar, { backgroundColor: '#2ED57320' }]}>
                        <Text style={[styles.proposalAvatarText, { color: '#2ED573' }]}>
                          {(proposerPost?.author?.name?.[0] ?? 'U').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.proposalDetails}>
                        <Text style={[styles.proposalName, { color: colors.text }]} numberOfLines={1}>
                          {proposerPost?.author?.name ?? 'User'}
                        </Text>
                        <Text style={[styles.proposalMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                          Offers: {proposerPost?.offering ?? '—'}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                <View style={styles.proposalActions}>
                  <TouchableOpacity
                    onPress={() => onAcceptProposal(match.id)}
                    style={[styles.proposalAcceptBtn, { backgroundColor: '#2ED573' }]}
                  >
                    <CheckCircle2 size={14} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDeclineProposal(match.id)}
                    style={[styles.proposalDeclineBtn, { backgroundColor: '#FF6B6B' }]}
                  >
                    <XCircle size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {acceptedOffers.length > 0 && (
        <View style={styles.proposalsSection}>
          <View style={styles.proposalsHeader}>
            <CheckCircle2 size={14} color="#2ED573" />
            <Text style={[styles.proposalsTitle, { color: colors.text }]}>
              {acceptedOffers.length} Accepted Worker{acceptedOffers.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {acceptedOffers.map((match) => {
            const proposerPost = getPostById(match.proposerPostId);
            const isCashOffer = match.isCashOffer === true;
            return (
              <View key={match.id} style={[styles.proposalCard, { backgroundColor: '#2ED57310', borderColor: '#2ED573' }]}>
                <View style={styles.proposalInfo}>
                  {isCashOffer ? (
                    <>
                      <View style={[styles.proposalAvatar, { backgroundColor: '#2ED57320' }]}>
                        <DollarSign size={16} color="#2ED573" />
                      </View>
                      <View style={styles.proposalDetails}>
                        <Text style={[styles.proposalName, { color: '#2ED573' }]}>
                          ${match.cashOffer} Accepted
                        </Text>
                        <Text style={[styles.proposalMeta, { color: colors.textSecondary }]}>
                          Worker ID: {match.proposerUserId}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.proposalAvatar, { backgroundColor: '#2ED57320' }]}>
                        <Text style={[styles.proposalAvatarText, { color: '#2ED573' }]}>
                          {(proposerPost?.author?.name?.[0] ?? 'U').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.proposalDetails}>
                        <Text style={[styles.proposalName, { color: colors.text }]} numberOfLines={1}>
                          {proposerPost?.author?.name ?? 'User'}
                        </Text>
                        <Text style={[styles.proposalMeta, { color: '#2ED573' }]} numberOfLines={1}>
                          Accepted
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                <View style={[styles.acceptedBadge, { backgroundColor: '#2ED57320' }]}>
                  <CheckCircle2 size={14} color="#2ED573" />
                </View>
              </View>
            );
          })}
          
          <TouchableOpacity
            onPress={() => onCompleteGig(post.id, acceptedOffers)}
            disabled={isCompletingGig}
            style={[styles.completeGigBtn, { backgroundColor: isCompletingGig ? colors.border : '#7B61FF' }]}
            testID={`completeGig_${post.id}`}
          >
            {isCompletingGig ? (
              <Text style={styles.completeGigBtnText}>Completing...</Text>
            ) : (
              <>
                <CheckCircle2 size={18} color="#fff" />
                <Text style={styles.completeGigBtnText}>Complete Gig</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {post.status === 'open' && (
        <TouchableOpacity
          onPress={() => onCloseGig(post.id)}
          disabled={isClosingGig}
          style={[styles.closeGigBtn, { backgroundColor: isClosingGig ? colors.border : '#FF6B6B' }]}
          testID={`closeGig_${post.id}`}
        >
          {isClosingGig ? (
            <Text style={styles.closeGigBtnText}>Closing...</Text>
          ) : (
            <>
              <XCircle size={18} color="#fff" />
              <Text style={styles.closeGigBtnText}>Close Gig</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {post.status !== 'open' && acceptedOffers.length > 0 && (
        <View style={styles.rateSection}>
          <Text style={[styles.rateTitle, { color: colors.text }]}>Rate workers</Text>
          <Text style={[styles.rateSubtitle, { color: colors.textSecondary }]}>Tap to leave a rating for each accepted worker.</Text>
          {acceptedOffers.map((m) => {
            const proposerPost = getPostById(m.proposerPostId);
            const workerName = proposerPost?.author?.name ?? 'Worker';
            return (
              <TouchableOpacity
                key={`rate_${post.id}_${m.id}`}
                onPress={() =>
                  onOpenReview({
                    requestId: post.id,
                    reviewerId: currentUserId,
                    revieweeId: m.proposerUserId,
                    title: 'Rate worker',
                    subtitle: workerName,
                  })
                }
                style={[styles.rateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                testID={`rateWorker_${m.proposerUserId}_${post.id}`}
              >
                <View style={styles.rateRowLeft}>
                  <View style={[styles.rateAvatar, { backgroundColor: '#FFB30020' }]}>
                    <Text style={[styles.rateAvatarText, { color: '#FFB300' }]}>{(workerName[0] ?? 'W').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rateRowTitle, { color: colors.text }]} numberOfLines={1}>
                      {workerName}
                    </Text>
                    <Text style={[styles.rateRowMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                      Leave stars + a note
                    </Text>
                  </View>
                </View>
                <View style={styles.ratePill}>
                  <Text style={styles.ratePillText}>Rate</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.myCardActions}>
        <TouchableOpacity
          onPress={onPressClose}
          disabled={post.status !== 'open'}
          style={[styles.myCardBtn, { borderColor: colors.border, opacity: post.status === 'open' ? 1 : 0.5 }]}
        >
          <CheckCircle2 size={16} color="#2ED573" />
          <Text style={[styles.myCardBtnText, { color: colors.text }]}>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPressDelete}
          style={[styles.myCardBtn, { borderColor: colors.border }]}
        >
          <Trash2 size={16} color="#FF6B6B" />
          <Text style={[styles.myCardBtnText, { color: '#FF6B6B' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CreatePostModal({
  visible,
  onClose,
  colors,
  form,
  setForm,
  canSubmit,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  form: CreateForm;
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isPaid = form.type === 'paid';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {isPaid ? 'Offer Paid Service' : 'Create Skill Swap'}
            </Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>


            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Quick Add Skills</Text>
              <Text style={[styles.formHint, { color: colors.textTertiary }]}>Select a skill to auto-fill or enter custom below</Text>
              <View style={styles.skillTemplatesRow}>
                {SKILL_TEMPLATES.map((skill) => {
                  const isSelected = form.selectedSkillTemplate === skill.id;
                  const SkillIcon = skill.id === 'chauffeur' ? Car : UserCheck;
                  return (
                    <TouchableOpacity
                      key={skill.id}
                      onPress={() => {
                        if (isSelected) {
                          setForm(p => ({ ...p, selectedSkillTemplate: null, vaSkills: [] }));
                        } else {
                          setForm(p => ({
                            ...p,
                            selectedSkillTemplate: skill.id,
                            title: skill.title,
                            offering: skill.offering,
                            category: skill.category,
                            isNegotiable: skill.negotiable,
                            price: '',
                            vaSkills: [],
                          }));
                        }
                      }}
                      style={[
                        styles.skillTemplateBtn,
                        {
                          backgroundColor: isSelected ? skill.color : colors.surface,
                          borderColor: isSelected ? skill.color : colors.border,
                        },
                      ]}
                    >
                      <SkillIcon size={18} color={isSelected ? '#fff' : skill.color} />
                      <Text style={[styles.skillTemplateText, { color: isSelected ? '#fff' : colors.text }]}>
                        {skill.label}
                      </Text>
                      {skill.negotiable && (
                        <View style={[styles.negotiableBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : skill.color + '15' }]}>
                          <MessageCircle size={10} color={isSelected ? '#fff' : skill.color} />
                          <Text style={[styles.negotiableBadgeText, { color: isSelected ? '#fff' : skill.color }]}>Negotiable</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {form.selectedSkillTemplate === 'virtual-assistant' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>What VA skills do you offer?</Text>
                <Text style={[styles.formHint, { color: colors.textTertiary }]}>Select all that apply</Text>
                <View style={styles.vaSkillsGrid}>
                  {VA_SKILL_OPTIONS.map((skill) => {
                    const isSelected = form.vaSkills.includes(skill.id);
                    return (
                      <TouchableOpacity
                        key={skill.id}
                        onPress={() => {
                          setForm(p => ({
                            ...p,
                            vaSkills: isSelected
                              ? p.vaSkills.filter(id => id !== skill.id)
                              : [...p.vaSkills, skill.id],
                          }));
                        }}
                        style={[
                          styles.vaSkillChip,
                          {
                            backgroundColor: isSelected ? '#7B61FF' : colors.surface,
                            borderColor: isSelected ? '#7B61FF' : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.vaSkillChipText, { color: isSelected ? '#fff' : colors.text }]}>
                          {skill.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {form.vaSkills.length === 0 && (
                  <Text style={[styles.vaSkillsWarning, { color: '#FF6B6B' }]}>Please select at least one skill</Text>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>What are you offering?</Text>
              <TextInput
                value={form.title}
                onChangeText={(t) => setForm(p => ({ ...p, title: t, selectedSkillTemplate: null, vaSkills: [] }))}
                placeholder="e.g., Logo design, Moving help, Tutoring"
                placeholderTextColor={colors.textTertiary}
                style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Describe your service</Text>
              <TextInput
                value={form.offering}
                onChangeText={(t) => setForm(p => ({ ...p, offering: t }))}
                placeholder="What will you deliver?"
                placeholderTextColor={colors.textTertiary}
                style={[styles.formInputMulti, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                multiline
                textAlignVertical="top"
              />
            </View>

            {!isPaid && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>What do you need in return?</Text>
                
                <View style={styles.needTypeToggle}>
                  <TouchableOpacity
                    onPress={() => setForm(p => ({ ...p, needCash: false, cashPrice: '' }))}
                    style={[
                      styles.needTypeBtn,
                      { 
                        backgroundColor: !form.needCash ? '#2ED573' : colors.surface, 
                        borderColor: !form.needCash ? '#2ED573' : colors.border 
                      },
                    ]}
                  >
                    <ArrowLeftRight size={16} color={!form.needCash ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.needTypeText, { color: !form.needCash ? '#fff' : colors.textSecondary }]}>
                      Service/Skill
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setForm(p => ({ ...p, needCash: true, needing: '' }))}
                    style={[
                      styles.needTypeBtn,
                      { 
                        backgroundColor: form.needCash ? '#FF6B6B' : colors.surface, 
                        borderColor: form.needCash ? '#FF6B6B' : colors.border 
                      },
                    ]}
                  >
                    <DollarSign size={16} color={form.needCash ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.needTypeText, { color: form.needCash ? '#fff' : colors.textSecondary }]}>
                      Cash
                    </Text>
                  </TouchableOpacity>
                </View>

                {form.needCash ? (
                  <View style={[styles.cashInputWrap, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                    <DollarSign size={20} color="#2ED573" />
                    <TextInput
                      value={form.cashPrice}
                      onChangeText={(t) => setForm(p => ({ ...p, cashPrice: t.replace(/[^0-9.]/g, '') }))}
                      placeholder="Enter amount"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      style={[styles.cashInputField, { color: colors.text }]}
                    />
                  </View>
                ) : (
                  <TextInput
                    value={form.needing}
                    onChangeText={(t) => setForm(p => ({ ...p, needing: t }))}
                    placeholder="e.g., Web development, Photography"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, marginTop: 12 }]}
                  />
                )}
              </View>
            )}

            {isPaid && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Your price ($)</Text>
                <View style={styles.priceRow}>
                  <TextInput
                    value={form.isNegotiable ? '' : form.price}
                    onChangeText={(t) => setForm(p => ({ ...p, price: t.replace(/[^0-9.]/g, ''), isNegotiable: false }))}
                    placeholder={form.isNegotiable ? 'Negotiable' : '50'}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    editable={!form.isNegotiable}
                    style={[
                      styles.formInputPrice, 
                      { 
                        backgroundColor: colors.surface, 
                        borderColor: colors.border, 
                        color: colors.text,
                        opacity: form.isNegotiable ? 0.5 : 1,
                      }
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => setForm(p => ({ ...p, isNegotiable: !p.isNegotiable, price: '' }))}
                    style={[
                      styles.negotiableToggle,
                      {
                        backgroundColor: form.isNegotiable ? '#2ED573' : colors.surface,
                        borderColor: form.isNegotiable ? '#2ED573' : colors.border,
                      },
                    ]}
                  >
                    <MessageCircle size={16} color={form.isNegotiable ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.negotiableToggleText, { color: form.isNegotiable ? '#fff' : colors.textSecondary }]}>
                      Negotiable
                    </Text>
                  </TouchableOpacity>
                </View>
                {form.isNegotiable && (
                  <Text style={[styles.negotiableHint, { color: '#2ED573' }]}>
                    Price will be open for negotiation with buyers
                  </Text>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setForm(p => ({ ...p, category: c.id }))}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: form.category === c.id ? c.color : colors.surface,
                        borderColor: form.category === c.id ? c.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, { color: form.category === c.id ? '#fff' : colors.textSecondary }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={onSubmit}
              disabled={!canSubmit}
              style={[styles.submitBtn, { backgroundColor: canSubmit ? (isPaid ? '#FF6B6B' : '#2ED573') : colors.border }]}
            >
              <Text style={[styles.submitBtnText, { color: canSubmit ? '#fff' : colors.textSecondary }]}>
                {isPaid ? 'Post Service' : 'Post Swap'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type ProposalType = 'swap' | 'cash';

type PaymentMethodOption = {
  id: OfferPaymentMethod;
  label: string;
  tint: string;
};

const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { id: 'stripe', label: 'Stripe', tint: '#2ED573' },
  { id: 'apple_pay', label: 'Apple Pay', tint: '#111827' },
  { id: 'cash', label: 'Cash', tint: '#FF6B6B' },
  { id: 'swap', label: 'Swap', tint: '#7C3AED' },
];

function ProposeSwapModal({
  visible,
  onClose,
  colors,
  myOpenPosts,
  targetPost,
  selectedMyPostId,
  setSelectedMyPostId,
  paymentMethod,
  setPaymentMethod,
  onSubmit,
  onSubmitCash,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  myOpenPosts: SwapPost[];
  targetPost: SwapPost | undefined;
  selectedMyPostId: string | null;
  setSelectedMyPostId: (v: string | null) => void;
  paymentMethod: OfferPaymentMethod;
  setPaymentMethod: (m: OfferPaymentMethod) => void;
  onSubmit: () => void;
  onSubmitCash: (amount: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [proposalType, setProposalType] = useState<ProposalType>('swap');
  const [cashAmount, setCashAmount] = useState<string>('');

  const isCash = proposalType === 'cash';
  const canSubmitSwap = selectedMyPostId && targetPost;
  const canSubmitCash = isCash && cashAmount.trim().length > 0 && parseFloat(cashAmount) > 0 && targetPost;

  const handleSubmit = () => {
    if (isCash && canSubmitCash) {
      onSubmitCash(parseFloat(cashAmount));
      setCashAmount('');
      setProposalType('swap');
    } else if (!isCash && canSubmitSwap) {
      onSubmit();
    }
  };

  const handleClose = () => {
    setCashAmount('');
    setProposalType('swap');
    setPaymentMethod('swap');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Make a Proposal</Text>
            <TouchableOpacity onPress={handleClose} style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {targetPost && (
            <View style={[styles.targetPostCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.targetLabel, { color: colors.textTertiary }]}>You&apos;re proposing to</Text>
              <Text style={[styles.targetTitle, { color: colors.text }]}>{targetPost.title}</Text>
              <Text style={[styles.targetMeta, { color: colors.textSecondary }]}>
                Needs: {targetPost.needing} • Offers: {targetPost.offering}
              </Text>
            </View>
          )}

          <View style={styles.paymentMethodSection}>
            <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>Payment method</Text>
            <View style={[styles.paymentMethodGrid, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="proposalPaymentMethodGrid">
              {PAYMENT_METHOD_OPTIONS.map((opt) => {
                const active = opt.id === paymentMethod;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setPaymentMethod(opt.id)}
                    style={[
                      styles.paymentMethodPill,
                      {
                        backgroundColor: active ? opt.tint : colors.background,
                        borderColor: active ? opt.tint : colors.border,
                      },
                    ]}
                    testID={`proposalPaymentMethod_${opt.id}`}
                  >
                    <Text style={[styles.paymentMethodPillText, { color: active ? '#fff' : colors.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.paymentMethodHint, { color: colors.textTertiary }]}>Saved on your proposal.</Text>
          </View>

          <View style={styles.proposalTypeToggle}>
            <TouchableOpacity
              onPress={() => setProposalType('swap')}
              style={[
                styles.proposalTypeBtn,
                { 
                  backgroundColor: !isCash ? '#2ED573' : colors.surface, 
                  borderColor: !isCash ? '#2ED573' : colors.border 
                },
              ]}
            >
              <ArrowLeftRight size={18} color={!isCash ? '#fff' : colors.textSecondary} />
              <Text style={[styles.proposalTypeText, { color: !isCash ? '#fff' : colors.textSecondary }]}>
                Swap Service
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setProposalType('cash')}
              style={[
                styles.proposalTypeBtn,
                { 
                  backgroundColor: isCash ? '#FF6B6B' : colors.surface, 
                  borderColor: isCash ? '#FF6B6B' : colors.border 
                },
              ]}
            >
              <DollarSign size={18} color={isCash ? '#fff' : colors.textSecondary} />
              <Text style={[styles.proposalTypeText, { color: isCash ? '#fff' : colors.textSecondary }]}>
                Cash Offer
              </Text>
            </TouchableOpacity>
          </View>

          {isCash ? (
            <View style={styles.cashOfferSection}>
              <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>Enter your cash offer</Text>
              <View style={[styles.cashInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <DollarSign size={20} color="#2ED573" />
                <TextInput
                  value={cashAmount}
                  onChangeText={(t) => setCashAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  style={[styles.cashInput, { color: colors.text }]}
                />
              </View>
              <Text style={[styles.cashHint, { color: colors.textTertiary }]}>
                Offer a cash payment instead of trading services
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>Select your post to swap</Text>
              
              <ScrollView style={{ maxHeight: 200 }}>
                {myOpenPosts.length === 0 ? (
                  <View style={[styles.noPostsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.noPostsText, { color: colors.textSecondary }]}>You have no active posts</Text>
                    <Text style={[styles.noPostsHint, { color: colors.textTertiary }]}>
                      Create a post first, or switch to Cash Offer
                    </Text>
                  </View>
                ) : (
                  myOpenPosts.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setSelectedMyPostId(p.id)}
                      style={[
                        styles.selectPostRow,
                        { backgroundColor: selectedMyPostId === p.id ? '#2ED573' + '15' : colors.surface, borderColor: selectedMyPostId === p.id ? '#2ED573' : colors.border },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.selectPostTitle, { color: colors.text }]}>{p.title}</Text>
                        <Text style={[styles.selectPostMeta, { color: colors.textSecondary }]}>Offers: {p.offering}</Text>
                      </View>
                      {selectedMyPostId === p.id && <CheckCircle2 size={20} color="#2ED573" />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isCash ? !canSubmitCash : !canSubmitSwap}
            style={[
              styles.submitBtn, 
              { 
                backgroundColor: (isCash ? canSubmitCash : canSubmitSwap) ? (isCash ? '#FF6B6B' : '#2ED573') : colors.border, 
                marginTop: 16 
              }
            ]}
          >
            <Text style={[styles.submitBtnText, { color: (isCash ? canSubmitCash : canSubmitSwap) ? '#fff' : colors.textSecondary }]}>
              {isCash ? `Send ${cashAmount || '0'} Offer` : 'Send Swap Proposal'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function MatchesModal({
  visible,
  onClose,
  colors,
  matches,
  getPostById,
  onOpenReview,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  matches: any[];
  getPostById: (id: string) => SwapPost | undefined;
  onOpenReview: (draft: ReviewDraft) => void;
  currentUserId: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const incoming = useMemo(() => matches.filter((m) => m.status === 'pending' && m.targetUserId === 'current-user'), [matches]);
  const outgoing = useMemo(() => matches.filter((m) => m.status === 'pending' && m.proposerUserId === 'current-user'), [matches]);
  const accepted = useMemo(() => matches.filter((m) => m.status === 'accepted'), [matches]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalSheetFull, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Swap Activity</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <MatchSection
              title="Incoming"
              subtitle="People want to swap with you"
              items={incoming}
              colors={colors}
              getPostById={getPostById}
              renderActions={(m) => (
                <View style={styles.matchActions}>
                  <TouchableOpacity onPress={() => onAccept(m.id)} style={[styles.matchAcceptBtn, { backgroundColor: '#2ED573' }]}>
                    <CheckCircle2 size={16} color="#fff" />
                    <Text style={styles.matchBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDecline(m.id)} style={[styles.matchDeclineBtn, { backgroundColor: '#FF6B6B' }]}>
                    <XCircle size={16} color="#fff" />
                    <Text style={styles.matchBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <MatchSection
              title="Outgoing"
              subtitle="Your pending proposals"
              items={outgoing}
              colors={colors}
              getPostById={getPostById}
              renderActions={(m) => (
                <View style={styles.matchActions}>
                  <TouchableOpacity onPress={() => onCancel(m.id)} style={[styles.matchCancelBtn, { borderColor: colors.border }]}>
                    <XCircle size={16} color={colors.textSecondary} />
                    <Text style={[styles.matchCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <MatchSection
              title="Active Swaps"
              subtitle="Confirmed exchanges"
              items={accepted}
              colors={colors}
              getPostById={getPostById}
              renderActions={(m) => {
                const target = getPostById(m.targetPostId);
                const isWorker = m.proposerUserId === currentUserId;
                const isCompleted = (target?.status ?? 'open') !== 'open';

                return (
                  <View style={styles.matchAcceptedRow}>
                    <View style={styles.matchAccepted}>
                      <CheckCircle2 size={16} color="#2ED573" />
                      <Text style={[styles.matchAcceptedText, { color: '#2ED573' }]}>Active</Text>
                    </View>

                    {isWorker && isCompleted && (
                      <TouchableOpacity
                        onPress={() =>
                          onOpenReview({
                            requestId: m.targetPostId,
                            reviewerId: currentUserId,
                            revieweeId: m.targetUserId,
                            title: 'Rate client',
                            subtitle: target?.author?.name ?? 'Client',
                          })
                        }
                        style={[styles.rateMatchBtn, { backgroundColor: '#FFB300' }]}
                        testID={`rateClient_${m.targetUserId}_${m.targetPostId}`}
                      >
                        <Text style={styles.rateMatchBtnText}>Rate</Text>
                      </TouchableOpacity>
                    )}

                    {isWorker && !isCompleted && (
                      <View style={[styles.rateMatchBtn, { backgroundColor: colors.border }]}>
                        <Text style={[styles.rateMatchBtnText, { color: colors.textSecondary }]}>Not completed</Text>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MatchSection({
  title,
  subtitle,
  items,
  colors,
  getPostById,
  renderActions,
}: {
  title: string;
  subtitle: string;
  items: any[];
  colors: any;
  getPostById: (id: string) => SwapPost | undefined;
  renderActions: (m: any) => React.ReactNode;
}) {
  return (
    <View style={styles.matchSection}>
      <Text style={[styles.matchSectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.matchSectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      
      {items.length === 0 ? (
        <View style={[styles.matchEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.matchEmptyText, { color: colors.textTertiary }]}>Nothing here yet</Text>
        </View>
      ) : (
        items.map((m) => {
          const proposer = getPostById(m.proposerPostId);
          const target = getPostById(m.targetPostId);
          const isCashOffer = m.isCashOffer === true;
          
          return (
            <View key={m.id} style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: isCashOffer ? '#FF6B6B' : colors.border }]}>
              {isCashOffer && (
                <View style={[styles.cashOfferBadge, { backgroundColor: '#FF6B6B15' }]}>
                  <DollarSign size={14} color="#FF6B6B" />
                  <Text style={styles.cashOfferBadgeText}>${m.cashOffer} Cash Offer</Text>
                </View>
              )}
              <View style={styles.matchCardHeader}>
                <Text style={[styles.matchCardTitle, { color: isCashOffer ? '#FF6B6B' : colors.text }]} numberOfLines={1}>
                  {isCashOffer ? `${m.cashOffer}` : (proposer?.title ?? 'Post')}
                </Text>
                <ArrowLeftRight size={16} color={colors.textSecondary} />
                <Text style={[styles.matchCardTitle, { color: colors.text }]} numberOfLines={1}>
                  {target?.title ?? 'Post'}
                </Text>
              </View>
              <Text style={[styles.matchCardMeta, { color: colors.textSecondary }]}>
                {isCashOffer ? `Cash payment of ${m.cashOffer}` : (proposer?.offering ?? '—')} ↔ {target?.offering ?? '—'}
              </Text>
              {renderActions(m)}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800' as const,
  },
  actionCardsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  actionCardWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  actionCard: {
    padding: 18,
    borderRadius: 18,
    flexDirection: 'row',
    minHeight: 100,
  },
  actionCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  actionCardLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  actionCardTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  actionCardIcon: {
    position: 'absolute',
    right: 60,
    top: '50%',
    marginTop: -18,
  },
  actionCardArrow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  segmentSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentPillActive: {},
  segmentText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  listSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  mineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mineHeaderText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  sectionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sectionPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  retryChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  retryChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  activeGigList: {
    gap: 10,
  },
  activeGigCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  activeGigTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  activeGigIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  activeGigTitleWrap: {
    flex: 1,
  },
  activeGigTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  activeGigMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  activeGigMetaText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  serviceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  serviceRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -16,
    marginHorizontal: -16,
    marginBottom: 12,
  },
  serviceRequestBannerText: {
    fontSize: 13,
    fontWeight: '700' as const,
    flex: 1,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  privacyBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  chauffeurLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  chauffeurLocationItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  chauffeurLocationLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  chauffeurLocationValue: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addressPrivacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  addressPrivacyText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceAvatarText: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  serviceHeaderInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceAuthor: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  serviceDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#999',
  },
  serviceTime: {
    fontSize: 12,
  },
  saveBtn: {
    padding: 4,
  },
  serviceSwapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  serviceSwapBlock: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
  },
  serviceSwapLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  serviceSwapValue: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  serviceSwapArrow: {
    paddingHorizontal: 4,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  categoryTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  proposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  proposeBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  serviceStatus: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  myCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  myCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  myCardBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  myRequestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  myRequestBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  requestTimeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  requestTimeEstimateText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  proposalsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  proposalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  proposalsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  proposalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  proposalInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proposalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalAvatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  proposalDetails: {
    flex: 1,
  },
  proposalName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  proposalMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  proposalAcceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalDeclineBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptedBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeGigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  completeGigBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  rateSection: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 179, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.35)',
  },
  rateTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.1,
  },
  rateSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
    fontWeight: '500' as const,
  },
  rateRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  rateAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateAvatarText: {
    fontSize: 14,
    fontWeight: '900' as const,
  },
  rateRowTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  rateRowMeta: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  ratePill: {
    backgroundColor: '#FFB300',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ratePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900' as const,
  },
  matchAcceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  rateMatchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateMatchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900' as const,
  },
  closeGigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  closeGigBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '90%',
  },
  modalSheetFull: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '95%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeToggleText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  formGroup: {
    marginBottom: 18,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  formInputMulti: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    height: 100,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  skillTemplatesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  skillTemplateBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  skillTemplateText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  negotiableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  negotiableBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  formHint: {
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formInputPrice: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  negotiableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  negotiableToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  negotiableHint: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500' as const,
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  targetPostCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  targetLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  targetTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  targetMeta: {
    fontSize: 13,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  noPostsText: {
    textAlign: 'center',
    padding: 20,
  },
  selectPostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  selectPostTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  selectPostMeta: {
    fontSize: 13,
  },
  matchSection: {
    marginBottom: 24,
  },
  matchSectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  matchSectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  matchEmpty: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  matchEmptyText: {
    fontSize: 14,
  },
  matchCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  matchCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  matchCardMeta: {
    fontSize: 13,
    marginBottom: 12,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 10,
  },
  matchAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  matchDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  matchCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  matchCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  matchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  matchAccepted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchAcceptedText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  proposalTypeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  proposalTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  proposalTypeText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  paymentMethodSection: {
    marginBottom: 14,
  },
  paymentMethodGrid: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  paymentMethodPillText: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  paymentMethodHint: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500' as const,
  },
  cashOfferSection: {
    marginBottom: 8,
  },
  cashInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    marginTop: 8,
  },
  cashInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700' as const,
  },
  cashHint: {
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  noPostsCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  noPostsHint: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  cashOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  cashOfferBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FF6B6B',
  },
  vaSkillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  vaSkillChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  vaSkillChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  vaSkillsWarning: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500' as const,
  },
  needTypeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  needTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  needTypeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  cashInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
