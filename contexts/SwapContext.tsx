import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useRef } from 'react';

import { type User } from '@/mocks/data';
import { supabase } from '@/lib/supabase';
import * as localApi from '@/lib/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SwapPostStatus = 'open' | 'matched' | 'closed';
export type SwapMatchStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type OfferPaymentMethod = 'stripe' | 'apple_pay' | 'cash' | 'swap';

export interface SwapPostPrivateDetails {
  pickupAddress?: string;
  destinationAddress?: string;
  pickupZip?: string;
  destinationZip?: string;
  pickupTime?: string;
  returnTime?: string;
  paymentMethod?: OfferPaymentMethod;
  date?: string;
}

export interface SwapPost {
  id: string;
  authorId: string;
  author: User;
  title: string;
  details: string;
  offering: string;
  needing: string;
  category: string;
  location?: string;
  timeEstimate?: string;
  price?: number;
  createdAt: string;
  status: SwapPostStatus;
  privateDetails?: SwapPostPrivateDetails;
  isServiceRequest?: boolean;
}

export interface SwapMatch {
  id: string;
  createdAt: string;
  status: SwapMatchStatus;
  proposerPostId: string;
  targetPostId: string;
  proposerUserId: string;
  targetUserId: string;
  proposerAccepted: boolean;
  targetAccepted: boolean;
  cashOffer?: number;
  isCashOffer?: boolean;
  paymentMethod?: OfferPaymentMethod;
}

interface SwapState {
  posts: SwapPost[];
  matches: SwapMatch[];
  savedPosts: string[];
  isLoading: boolean;
  createPost: (input: Omit<SwapPost, 'id' | 'authorId' | 'author' | 'createdAt' | 'status'>) => string;
  deletePost: (postId: string) => void;
  closePost: (postId: string) => void;
  proposeSwap: (proposerPostId: string, targetPostId: string, cashOffer?: number, paymentMethod?: OfferPaymentMethod) => void;
  acceptMatch: (matchId: string) => void;
  declineMatch: (matchId: string) => void;
  cancelMatch: (matchId: string) => void;
  clearAll: () => void;
  getMyPosts: () => SwapPost[];
  getOpenPosts: () => SwapPost[];
  getMyMatches: () => SwapMatch[];
  getSavedPosts: () => SwapPost[];
  getPostById: (postId: string) => SwapPost | undefined;
  getMatchById: (matchId: string) => SwapMatch | undefined;
  toggleSavePost: (postId: string) => void;
  isPostSaved: (postId: string) => boolean;
}

const POSTS_KEY = 'apparently_swap_posts_v1';
const MATCHES_KEY = 'apparently_swap_matches_v1';
const SAVED_POSTS_KEY = 'apparently_swap_saved_v1';

const nowIso = () => new Date().toISOString();

const makeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw || raw === 'undefined' || raw === 'null') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('[SwapContext] JSON parse error, clearing corrupted data:', e);
    return fallback;
  }
};

const getUserForAuthor = (authorName?: string, phone?: string): User => {
  const fallback: User = {
    id: 'current-user',
    name: 'You',
    username: 'you',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    isVerified: false,
    followersCount: 0,
  };

  const seed = encodeURIComponent(`${authorName ?? 'You'}-${phone ?? ''}`);

  return {
    ...fallback,
    id: 'current-user',
    name: authorName ?? 'You',
    username: 'you',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`,
    isVerified: false,
    followersCount: 0,
  };
};

const starterPosts = (): SwapPost[] => {
  return [];
};

export const [SwapProvider, useSwap] = createContextHook<SwapState>(() => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User>(() => getUserForAuthor(undefined, undefined));
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const currentUserId = 'current-user';

  const userQuery = useQuery({
    queryKey: ['swapCurrentUser'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem('apparently_auth');
        if (stored && stored !== 'undefined') {
          const authData = JSON.parse(stored);
          if (authData?.user) {
            return getUserForAuthor(authData.user.name, authData.user.phone);
          }
        }
        return getUserForAuthor(undefined, undefined);
      } catch (e) {
        console.error('[SwapContext] Error loading user:', e);
        return getUserForAuthor(undefined, undefined);
      }
    },
  });

  useEffect(() => {
    if (userQuery.data) {
      setCurrentUser(userQuery.data);
    }
  }, [userQuery.data]);

  const [posts, setPosts] = useState<SwapPost[]>([]);
  const [matches, setMatches] = useState<SwapMatch[]>([]);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);

  const postsQuery = useQuery({
    queryKey: ['swapPosts'],
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(POSTS_KEY);
        const parsed = safeParse<SwapPost[]>(raw, []);
        if (parsed.length > 0) {
          console.log('[SwapContext] Hydrated posts from storage:', parsed.length);
          return parsed;
        }
        const seeds = starterPosts();
        console.log('[SwapContext] Using starter posts:', seeds.length);
        return seeds;
      } catch (e) {
        console.error('[SwapContext] Error loading posts:', e);
        return starterPosts();
      }
    },
  });

  const matchesQuery = useQuery({
    queryKey: ['swapMatches'],
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(MATCHES_KEY);
        const parsed = safeParse<SwapMatch[]>(raw, []);
        console.log('[SwapContext] Hydrated matches from storage:', parsed.length);
        return parsed;
      } catch (e) {
        console.error('[SwapContext] Error loading matches:', e);
        return [];
      }
    },
  });

  const savedPostsQuery = useQuery({
    queryKey: ['swapSavedPosts'],
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_POSTS_KEY);
        const parsed = safeParse<string[]>(raw, []);
        console.log('[SwapContext] Hydrated saved posts from storage:', parsed.length);
        return parsed;
      } catch (e) {
        console.error('[SwapContext] Error loading saved posts:', e);
        return [];
      }
    },
  });

  const { mutate: persistPostsMutate } = useMutation({
    mutationFn: async (payload: SwapPost[]) => {
      await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(payload));
      console.log('[SwapContext] Persisted posts:', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swapPosts'] });
    },
  });

  const { mutate: persistMatchesMutate } = useMutation({
    mutationFn: async (payload: SwapMatch[]) => {
      await AsyncStorage.setItem(MATCHES_KEY, JSON.stringify(payload));
      console.log('[SwapContext] Persisted matches:', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swapMatches'] });
    },
  });

  const { mutate: persistSavedPostsMutate } = useMutation({
    mutationFn: async (payload: string[]) => {
      await AsyncStorage.setItem(SAVED_POSTS_KEY, JSON.stringify(payload));
      console.log('[SwapContext] Persisted saved posts:', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swapSavedPosts'] });
    },
  });

  useEffect(() => {
    if (postsQuery.data) setPosts(postsQuery.data);
  }, [postsQuery.data]);

  useEffect(() => {
    if (matchesQuery.data) setMatches(matchesQuery.data);
  }, [matchesQuery.data]);

  useEffect(() => {
    if (savedPostsQuery.data) setSavedPosts(savedPostsQuery.data);
  }, [savedPostsQuery.data]);

  useEffect(() => {
    console.log('[SwapContext] Setting up Supabase realtime subscription for offers table');
    
    const channel = supabase
      .channel('offers-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'offers',
        },
        (payload) => {
          console.log('[SwapContext] New offer received via realtime:', payload);
          queryClient.invalidateQueries({ queryKey: ['swapMatches'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'offers',
        },
        (payload) => {
          console.log('[SwapContext] Offer updated via realtime:', payload);
          queryClient.invalidateQueries({ queryKey: ['swapMatches'] });
        }
      )
      .subscribe((status) => {
        console.log('[SwapContext] Realtime subscription status:', status);
      });

    realtimeChannelRef.current = channel;

    return () => {
      console.log('[SwapContext] Cleaning up realtime subscription');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [queryClient]);

  const createPost: SwapState['createPost'] = useCallback(
    (input) => {
      const newPost: SwapPost = {
        id: makeId(),
        authorId: currentUserId,
        author: currentUser,
        title: input.title.trim(),
        details: input.details.trim(),
        offering: input.offering.trim(),
        needing: input.needing.trim(),
        category: input.category.trim(),
        location: input.location?.trim() || undefined,
        timeEstimate: input.timeEstimate?.trim() || undefined,
        price: input.price,
        createdAt: nowIso(),
        status: 'open',
        privateDetails: input.privateDetails,
        isServiceRequest: input.isServiceRequest,
      };

      const next = [newPost, ...posts];
      setPosts(next);
      persistPostsMutate(next);
      console.log('[SwapContext] Created post:', newPost.id);
      return newPost.id;
    },
    [currentUser, currentUserId, persistPostsMutate, posts]
  );

  const deletePost: SwapState['deletePost'] = useCallback(
    (postId) => {
      const next = posts.filter((p) => p.id !== postId);
      setPosts(next);
      persistPostsMutate(next);

      const relatedMatches = matches.filter((m) => m.proposerPostId === postId || m.targetPostId === postId);
      if (relatedMatches.length > 0) {
        const matchIds = new Set(relatedMatches.map((m) => m.id));
        const nextMatches = matches.filter((m) => !matchIds.has(m.id));
        setMatches(nextMatches);
        persistMatchesMutate(nextMatches);
      }

      console.log('[SwapContext] Deleted post:', postId);
    },
    [matches, persistMatchesMutate, persistPostsMutate, posts]
  );

  const closePost: SwapState['closePost'] = useCallback(
    (postId) => {
      const next = posts.map((p) => (p.id === postId ? { ...p, status: 'closed' as const } : p));
      setPosts(next);
      persistPostsMutate(next);
      console.log('[SwapContext] Closed post:', postId);
    },
    [persistPostsMutate, posts]
  );

  const proposeSwap: SwapState['proposeSwap'] = useCallback(
    (proposerPostId, targetPostId, cashOffer, paymentMethod) => {
      const isCashOffer = cashOffer !== undefined && cashOffer > 0;
      
      if (!isCashOffer && !proposerPostId) {
        console.log('[SwapContext] proposeSwap missing proposer post for swap');
        return;
      }
      
      if (!targetPostId) {
        console.log('[SwapContext] proposeSwap missing target post');
        return;
      }

      if (!isCashOffer && proposerPostId === targetPostId) {
        console.log('[SwapContext] proposeSwap blocked (same post)');
        return;
      }

      const target = posts.find((p) => p.id === targetPostId);
      if (!target) {
        console.log('[SwapContext] proposeSwap missing target post');
        return;
      }

      if (target.authorId === currentUserId) {
        console.log('[SwapContext] proposeSwap blocked (cannot target your own post)');
        return;
      }

      if (!isCashOffer) {
        const proposer = posts.find((p) => p.id === proposerPostId);
        if (!proposer) {
          console.log('[SwapContext] proposeSwap missing proposer post');
          return;
        }
        if (proposer.authorId !== currentUserId) {
          console.log('[SwapContext] proposeSwap blocked (not your proposer post)');
          return;
        }
      }

      const existing = matches.find(
        (m) =>
          m.status === 'pending' &&
          ((m.proposerPostId === proposerPostId && m.targetPostId === targetPostId) ||
            (m.proposerPostId === targetPostId && m.targetPostId === proposerPostId))
      );
      if (existing && !isCashOffer) {
        console.log('[SwapContext] proposeSwap ignored (already pending):', existing.id);
        return;
      }

      const derivedPaymentMethod: OfferPaymentMethod | undefined = paymentMethod
        ? paymentMethod
        : isCashOffer
          ? 'cash'
          : undefined;

      const newMatch: SwapMatch = {
        id: makeId(),
        createdAt: nowIso(),
        status: 'pending',
        proposerPostId: isCashOffer ? `cash_${makeId()}` : proposerPostId,
        targetPostId,
        proposerUserId: currentUserId,
        targetUserId: target.authorId,
        proposerAccepted: true,
        targetAccepted: false,
        cashOffer: isCashOffer ? cashOffer : undefined,
        isCashOffer,
        paymentMethod: derivedPaymentMethod,
      };

      const nextMatches = [newMatch, ...matches];
      setMatches(nextMatches);
      persistMatchesMutate(nextMatches);
      console.log('[SwapContext] Proposed swap:', newMatch.id, {
        kind: isCashOffer ? 'cash' : 'swap',
        cashOffer,
        paymentMethod: newMatch.paymentMethod,
      });
    },
    [currentUserId, matches, persistMatchesMutate, posts]
  );

  const acceptMatch: SwapState['acceptMatch'] = useCallback(
    (matchId) => {
      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      if (match.targetUserId !== currentUserId && match.proposerUserId !== currentUserId) {
        console.log('[SwapContext] acceptMatch blocked (not participant)');
        return;
      }

      const nextMatches = matches.map((m) => {
        if (m.id !== matchId) return m;
        const updated = {
          ...m,
          proposerAccepted: m.proposerUserId === currentUserId ? true : m.proposerAccepted,
          targetAccepted: m.targetUserId === currentUserId ? true : m.targetAccepted,
        };
        const isAccepted = updated.proposerAccepted && updated.targetAccepted;
        return { ...updated, status: isAccepted ? ('accepted' as const) : ('pending' as const) };
      });

      setMatches(nextMatches);
      persistMatchesMutate(nextMatches);

      const updated = nextMatches.find((m) => m.id === matchId);
      if (updated?.status === 'accepted') {
        const acceptedPostIds = new Set([updated.proposerPostId, updated.targetPostId]);
        const nextPosts = posts.map((p) => (acceptedPostIds.has(p.id) ? { ...p, status: 'matched' as const } : p));
        setPosts(nextPosts);
        persistPostsMutate(nextPosts);
      }

      console.log('[SwapContext] Accepted match:', matchId);
    },
    [currentUserId, matches, persistMatchesMutate, persistPostsMutate, posts]
  );

  const declineMatch: SwapState['declineMatch'] = useCallback(
    (matchId) => {
      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      if (match.targetUserId !== currentUserId && match.proposerUserId !== currentUserId) {
        console.log('[SwapContext] declineMatch blocked (not participant)');
        return;
      }

      const nextMatches = matches.map((m) => (m.id === matchId ? { ...m, status: 'declined' as const } : m));
      setMatches(nextMatches);
      persistMatchesMutate(nextMatches);
      console.log('[SwapContext] Declined match:', matchId);
    },
    [currentUserId, matches, persistMatchesMutate]
  );

  const cancelMatch: SwapState['cancelMatch'] = useCallback(
    (matchId) => {
      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      if (match.proposerUserId !== currentUserId) {
        console.log('[SwapContext] cancelMatch blocked (only proposer)');
        return;
      }

      const nextMatches = matches.map((m) => (m.id === matchId ? { ...m, status: 'cancelled' as const } : m));
      setMatches(nextMatches);
      persistMatchesMutate(nextMatches);
      console.log('[SwapContext] Cancelled match:', matchId);
    },
    [currentUserId, matches, persistMatchesMutate]
  );

  const getPostById = useCallback((postId: string) => posts.find((p) => p.id === postId), [posts]);
  const getMatchById = useCallback((matchId: string) => matches.find((m) => m.id === matchId), [matches]);

  const getMyPosts = useCallback(() => posts.filter((p) => p.authorId === currentUserId), [posts]);
  const getOpenPosts = useCallback(() => posts.filter((p) => p.status === 'open' && p.authorId !== currentUserId), [posts]);

  const getMyMatches = useCallback(
    () => matches.filter((m) => m.proposerUserId === currentUserId || m.targetUserId === currentUserId),
    [matches]
  );

  const getSavedPosts = useCallback(
    () => posts.filter((p) => savedPosts.includes(p.id)),
    [posts, savedPosts]
  );

  const toggleSavePost = useCallback(
    (postId: string) => {
      const isSaved = savedPosts.includes(postId);
      const next = isSaved
        ? savedPosts.filter((id) => id !== postId)
        : [...savedPosts, postId];
      setSavedPosts(next);
      persistSavedPostsMutate(next);
      console.log('[SwapContext] Toggled save post:', postId, !isSaved);
    },
    [savedPosts, persistSavedPostsMutate]
  );

  const isPostSaved = useCallback(
    (postId: string) => savedPosts.includes(postId),
    [savedPosts]
  );

  const clearAll = useCallback(() => {
    const nextPosts: SwapPost[] = starterPosts();
    const nextMatches: SwapMatch[] = [];
    setPosts(nextPosts);
    setMatches(nextMatches);
    persistPostsMutate(nextPosts);
    persistMatchesMutate(nextMatches);
    console.log('[SwapContext] Cleared all swap data');
  }, [persistMatchesMutate, persistPostsMutate]);

  const isLoading = postsQuery.isLoading || matchesQuery.isLoading || savedPostsQuery.isLoading;

  return {
    posts,
    matches,
    savedPosts,
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
    getMatchById,
    toggleSavePost,
    isPostSaved,
    clearAll,
  };
});
