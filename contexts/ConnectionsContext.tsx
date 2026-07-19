import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useCallback } from 'react';

import { DatabaseService } from '@/lib/database';
import * as localApi from '@/lib/api';
import type { DbUser } from '@/lib/database.types';
import type { MarketplaceProfile } from '@/mocks/data';

export type ConnectionStatus = 'pending' | 'approved' | 'rejected';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromProfile: MarketplaceProfile;
  toProfile?: MarketplaceProfile;
  status: ConnectionStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  id: string;
  userId: string;
  profile: MarketplaceProfile;
  connectedAt: string;
  canMessage: boolean;
}

export interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export type InteractionType = 'call' | 'chat' | 'collaboration';

export interface UserInteraction {
  id: string;
  userId: string;
  type: InteractionType;
  timestamp: string;
  duration?: number;
  notes?: string;
}

export interface UserRating {
  id: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  review?: string;
  timestamp: string;
}

export interface UserRatingSummary {
  userId: string;
  averageRating: number;
  totalRatings: number;
  ratings: UserRating[];
}

interface ConnectionsState {
  requests: ConnectionRequest[];
  connections: Connection[];
  messages: Message[];
  hiddenProfiles: string[];
  interactions: UserInteraction[];
  ratings: UserRating[];
}

const STORAGE_KEY = 'apparently_connections';

const mapDbUserToMarketplaceProfile = (u: DbUser): MarketplaceProfile => ({
  id: u.id,
  name: u.name,
  username: u.username,
  avatar: u.avatar,
  location: '—',
  distance: 0,
  skills: [],
  bio: '',
  lookingFor: 'networking',
  category: 'General',
  verified: Boolean(u.is_verified),
  rating: 0,
  reviewCount: 0,
  availability: 'available',
  hourlyRate: '',
});

const CURRENT_USER_ID = 'current-user';

const sampleIncomingRequests: ConnectionRequest[] = [];

const defaultState: ConnectionsState = {
  requests: [],
  connections: [],
  messages: [],
  hiddenProfiles: [],
  interactions: [],
  ratings: [],
};

const ensureValidState = (state: Partial<ConnectionsState> | null): ConnectionsState => {
  if (!state) return defaultState;
  return {
    requests: Array.isArray(state.requests) ? state.requests : sampleIncomingRequests,
    connections: Array.isArray(state.connections) ? state.connections : [],
    messages: Array.isArray(state.messages) ? state.messages : [],
    hiddenProfiles: Array.isArray(state.hiddenProfiles) ? state.hiddenProfiles : [],
    interactions: Array.isArray(state.interactions) ? state.interactions : [],
    ratings: Array.isArray(state.ratings) ? state.ratings : [],
  };
};

export const [ConnectionsProvider, useConnections] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConnectionsState>(defaultState);

  const query = useQuery({
    queryKey: ['connections'],
    queryFn: async ({ signal }) => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          console.log('[ConnectionsContext] Hydrated state from storage');
          const parsed = JSON.parse(stored);
          return ensureValidState(parsed);
        }

        console.log('[ConnectionsContext] Building connections from Supabase users');
        try {
          const userId = await DatabaseService.getCurrentUserId();
          const users = await DatabaseService.fetchUsers({ signal });
          const profiles = users.map(mapDbUserToMarketplaceProfile);
          const connections: Connection[] = profiles
            .filter((p) => p.id !== (userId ?? ''))
            .slice(0, 50)
            .map((p) => ({
              id: `conn_${p.id}`,
              userId: p.id,
              profile: p,
              connectedAt: new Date().toISOString(),
              canMessage: true,
            }));

          return {
            requests: [],
            connections,
            messages: [],
            hiddenProfiles: [],
            interactions: [],
            ratings: [],
          } as ConnectionsState;
        } catch (supabaseError) {
          console.log('[ConnectionsContext] Supabase unavailable, trying local API...');
        }

        // Fall back to local API
        try {
          const localRequests = await localApi.getConnectionRequests();
          console.log('[ConnectionsContext] Local connection requests:', localRequests?.length || 0);
          return {
            requests: (localRequests || []).map((r: any) => ({
              id: r.id,
              fromUserId: r.from_user_id,
              toUserId: r.to_user_id,
              fromProfile: { id: r.from_user_id, name: r.from_name || 'User', avatar: r.from_avatar || '', isVerified: false },
              toProfile: { id: r.to_user_id, name: r.to_name || 'User', avatar: r.to_avatar || '', isVerified: false },
              status: r.status || 'pending',
              message: r.message,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            })),
            connections: [],
            messages: [],
            hiddenProfiles: [],
            interactions: [],
            ratings: [],
          } as ConnectionsState;
        } catch (e2) {
          console.log('[ConnectionsContext] Local API also unavailable');
        }

        return defaultState;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[ConnectionsContext] Fetch aborted (navigation)');
          return defaultState;
        }
        console.error('[ConnectionsContext] Error loading state:', error);
        return defaultState;
      }
    },
    staleTime: 1000 * 60 * 2,
    retry: (failureCount, error: any) => error?.name !== 'AbortError' && failureCount < 2,
  });

  const saveMutation = useMutation({
    mutationFn: async (newState: ConnectionsState) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      console.log('[ConnectionsContext] Persisted state');
      return newState;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });

  useEffect(() => {
    if (query.data) {
      setState(query.data);
    }
  }, [query.data]);

  const { mutate: saveState } = saveMutation;

  const persistState = useCallback((next: ConnectionsState) => {
    setState(next);
    saveState(next);
  }, [saveState]);

  const sendConnectionRequest = useCallback((toProfile: MarketplaceProfile, message?: string) => {
    const existingRequest = state.requests.find(
      (r) => r.toUserId === toProfile.id && r.fromUserId === CURRENT_USER_ID
    );
    
    if (existingRequest) {
      console.log('[ConnectionsContext] Request already exists for:', toProfile.name);
      return existingRequest;
    }

    const existingConnection = state.connections.find((c) => c.userId === toProfile.id);
    if (existingConnection) {
      console.log('[ConnectionsContext] Already connected with:', toProfile.name);
      return null;
    }

    const now = new Date().toISOString();
    const newRequest: ConnectionRequest = {
      id: `req-${Date.now()}`,
      fromUserId: CURRENT_USER_ID,
      toUserId: toProfile.id,
      fromProfile: {
        id: CURRENT_USER_ID,
        name: 'You',
        username: 'you',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
        location: 'New York, NY',
        distance: 0,
        skills: ['Networking'],
        bio: 'Looking to connect!',
        lookingFor: 'networking',
        category: 'General',
        verified: false,
        rating: 5.0,
        reviewCount: 0,
        availability: 'available',
      },
      toProfile: toProfile,
      status: 'pending',
      message,
      createdAt: now,
      updatedAt: now,
    };

    const updated = {
      ...state,
      requests: [...state.requests, newRequest],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Sent request to:', toProfile.name);
    return newRequest;
  }, [state, persistState]);

  const receiveConnectionRequest = useCallback((fromProfile: MarketplaceProfile, message?: string) => {
    const existingRequest = state.requests.find(
      (r) => r.fromUserId === fromProfile.id && r.toUserId === CURRENT_USER_ID
    );
    
    if (existingRequest) {
      console.log('[ConnectionsContext] Incoming request already exists from:', fromProfile.name);
      return existingRequest;
    }

    const now = new Date().toISOString();
    const newRequest: ConnectionRequest = {
      id: `req-${Date.now()}`,
      fromUserId: fromProfile.id,
      toUserId: CURRENT_USER_ID,
      fromProfile: fromProfile,
      status: 'pending',
      message,
      createdAt: now,
      updatedAt: now,
    };

    const updated = {
      ...state,
      requests: [...state.requests, newRequest],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Received request from:', fromProfile.name);
    return newRequest;
  }, [state, persistState]);

  const approveRequest = useCallback((requestId: string) => {
    const request = state.requests.find((r) => r.id === requestId);
    if (!request) {
      console.log('[ConnectionsContext] Request not found:', requestId);
      return;
    }

    const now = new Date().toISOString();
    
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      userId: request.fromUserId,
      profile: request.fromProfile,
      connectedAt: now,
      canMessage: true,
    };

    const updatedRequests = state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'approved' as ConnectionStatus, updatedAt: now } : r
    );

    const updated = {
      ...state,
      requests: updatedRequests,
      connections: [...state.connections, newConnection],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Approved request from:', request.fromProfile.name);
  }, [state, persistState]);

  const rejectRequest = useCallback((requestId: string) => {
    const now = new Date().toISOString();
    const updatedRequests = state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'rejected' as ConnectionStatus, updatedAt: now } : r
    );
    
    const updated = {
      ...state,
      requests: updatedRequests,
    };
    persistState(updated);
    console.log('[ConnectionsContext] Rejected request:', requestId);
  }, [state, persistState]);

  const deleteRequest = useCallback((requestId: string) => {
    const updated = {
      ...state,
      requests: state.requests.filter((r) => r.id !== requestId),
    };
    persistState(updated);
    console.log('[ConnectionsContext] Deleted request:', requestId);
  }, [state, persistState]);

  const cancelConnectionRequest = useCallback((userId: string) => {
    const updated = {
      ...state,
      requests: state.requests.filter(
        (r) => !(r.toUserId === userId && r.fromUserId === CURRENT_USER_ID && r.status === 'pending')
      ),
    };
    persistState(updated);
    console.log('[ConnectionsContext] Cancelled request to:', userId);
  }, [state, persistState]);

  const markNotInterested = useCallback((userId: string) => {
    const hiddenProfiles = Array.isArray(state.hiddenProfiles) ? state.hiddenProfiles : [];
    if (hiddenProfiles.includes(userId)) {
      console.log('[ConnectionsContext] Profile already hidden:', userId);
      return;
    }
    const updated = {
      ...state,
      hiddenProfiles: [...hiddenProfiles, userId],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Marked not interested:', userId);
  }, [state, persistState]);

  const unhideProfile = useCallback((userId: string) => {
    const hiddenProfiles = Array.isArray(state.hiddenProfiles) ? state.hiddenProfiles : [];
    const updated = {
      ...state,
      hiddenProfiles: hiddenProfiles.filter((id) => id !== userId),
    };
    persistState(updated);
    console.log('[ConnectionsContext] Unhid profile:', userId);
  }, [state, persistState]);

  const clearHiddenProfiles = useCallback(() => {
    const updated = {
      ...state,
      hiddenProfiles: [],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Cleared all hidden profiles');
  }, [state, persistState]);

  const isProfileHidden = useCallback((userId: string) => {
    return Array.isArray(state.hiddenProfiles) && state.hiddenProfiles.includes(userId);
  }, [state.hiddenProfiles]);

  const sendMessage = useCallback((connectionId: string, receiverId: string, text: string) => {
    const connection = state.connections.find((c) => c.id === connectionId);
    if (!connection || !connection.canMessage) {
      console.log('[ConnectionsContext] Cannot send message to this connection');
      return null;
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      connectionId,
      senderId: CURRENT_USER_ID,
      receiverId,
      text,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const updated = {
      ...state,
      messages: [...state.messages, newMessage],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Sent message to:', receiverId);
    return newMessage;
  }, [state, persistState]);

  const getMessagesForConnection = useCallback((connectionId: string) => {
    return state.messages.filter((m) => m.connectionId === connectionId);
  }, [state.messages]);

  const markMessageRead = useCallback((messageId: string) => {
    const updated = {
      ...state,
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, read: true } : m
      ),
    };
    persistState(updated);
  }, [state, persistState]);

  const incomingRequests = useMemo(() => {
    return state.requests.filter(
      (r) => r.toUserId === CURRENT_USER_ID && r.status === 'pending'
    );
  }, [state.requests]);

  const outgoingRequests = useMemo(() => {
    return state.requests.filter(
      (r) => r.fromUserId === CURRENT_USER_ID && r.status === 'pending'
    );
  }, [state.requests]);

  const approvedConnections = useMemo(() => {
    return state.connections;
  }, [state.connections]);

  const isConnectedWith = useCallback((userId: string) => {
    return state.connections.some((c) => c.userId === userId);
  }, [state.connections]);

  const hasPendingRequestTo = useCallback((userId: string) => {
    return state.requests.some(
      (r) => r.toUserId === userId && r.fromUserId === CURRENT_USER_ID && r.status === 'pending'
    );
  }, [state.requests]);

  const hasPendingRequestFrom = useCallback((userId: string) => {
    return state.requests.some(
      (r) => r.fromUserId === userId && r.toUserId === CURRENT_USER_ID && r.status === 'pending'
    );
  }, [state.requests]);

  const getConnectionStatus = useCallback((userId: string): 'connected' | 'pending_sent' | 'pending_received' | 'none' => {
    if (isConnectedWith(userId)) return 'connected';
    if (hasPendingRequestTo(userId)) return 'pending_sent';
    if (hasPendingRequestFrom(userId)) return 'pending_received';
    return 'none';
  }, [isConnectedWith, hasPendingRequestTo, hasPendingRequestFrom]);

  const unreadMessagesCount = useMemo(() => {
    return state.messages.filter((m) => !m.read && m.receiverId === CURRENT_USER_ID).length;
  }, [state.messages]);

  const addInteraction = useCallback((userId: string, type: InteractionType, duration?: number, notes?: string) => {
    const newInteraction: UserInteraction = {
      id: `int-${Date.now()}`,
      userId,
      type,
      timestamp: new Date().toISOString(),
      duration,
      notes,
    };
    const updated = {
      ...state,
      interactions: [...state.interactions, newInteraction],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Added interaction:', type, 'with:', userId);
    return newInteraction;
  }, [state, persistState]);

  const getInteractionsWithUser = useCallback((userId: string): UserInteraction[] => {
    return state.interactions.filter((i) => i.userId === userId);
  }, [state.interactions]);

  const getInteractionCount = useCallback((userId: string): number => {
    return state.interactions.filter((i) => i.userId === userId).length;
  }, [state.interactions]);

  const canRateUser = useCallback((userId: string): boolean => {
    const interactionCount = state.interactions.filter((i) => i.userId === userId).length;
    const hasAlreadyRated = state.ratings.some(
      (r) => r.fromUserId === CURRENT_USER_ID && r.toUserId === userId
    );
    return interactionCount >= 5 && !hasAlreadyRated;
  }, [state.interactions, state.ratings]);

  const hasRatedUser = useCallback((userId: string): boolean => {
    return state.ratings.some(
      (r) => r.fromUserId === CURRENT_USER_ID && r.toUserId === userId
    );
  }, [state.ratings]);

  const addRating = useCallback((userId: string, rating: number, review?: string) => {
    if (!canRateUser(userId)) {
      console.log('[ConnectionsContext] Cannot rate user yet - need 5 interactions or already rated');
      return null;
    }
    const newRating: UserRating = {
      id: `rating-${Date.now()}`,
      fromUserId: CURRENT_USER_ID,
      toUserId: userId,
      rating,
      review,
      timestamp: new Date().toISOString(),
    };
    const updated = {
      ...state,
      ratings: [...state.ratings, newRating],
    };
    persistState(updated);
    console.log('[ConnectionsContext] Added rating for:', userId, 'rating:', rating);
    return newRating;
  }, [state, persistState, canRateUser]);

  const getUserRatingSummary = useCallback((userId: string): UserRatingSummary | null => {
    const userRatings = state.ratings.filter((r) => r.toUserId === userId);
    if (userRatings.length === 0) return null;
    const total = userRatings.reduce((sum, r) => sum + r.rating, 0);
    return {
      userId,
      averageRating: Number((total / userRatings.length).toFixed(1)),
      totalRatings: userRatings.length,
      ratings: userRatings,
    };
  }, [state.ratings]);

  const getAllRatingsForUser = useCallback((userId: string): UserRating[] => {
    return state.ratings.filter((r) => r.toUserId === userId);
  }, [state.ratings]);

  return {
    requests: state.requests,
    connections: state.connections,
    messages: state.messages,
    hiddenProfiles: state.hiddenProfiles,
    isLoading: query.isLoading,
    incomingRequests,
    outgoingRequests,
    approvedConnections,
    unreadMessagesCount,
    sendConnectionRequest,
    receiveConnectionRequest,
    approveRequest,
    rejectRequest,
    deleteRequest,
    cancelConnectionRequest,
    markNotInterested,
    unhideProfile,
    clearHiddenProfiles,
    isProfileHidden,
    sendMessage,
    getMessagesForConnection,
    markMessageRead,
    isConnectedWith,
    hasPendingRequestTo,
    hasPendingRequestFrom,
    getConnectionStatus,
    interactions: state.interactions,
    ratings: state.ratings,
    addInteraction,
    getInteractionsWithUser,
    getInteractionCount,
    canRateUser,
    hasRatedUser,
    addRating,
    getUserRatingSummary,
    getAllRatingsForUser,
  };
});
