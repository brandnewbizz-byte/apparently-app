import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getApiUrl, fastFetch } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeBundleDesc } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

export type ServiceCategory =
  | 'photography'
  | 'chef'
  | 'music'
  | 'dj'
  | 'cleaning'
  | 'fitness'
  | 'beauty'
  | 'tech'
  | 'tutoring'
  | 'delivery'
  | 'events'
  | 'transport'
  | 'design'
  | 'other';

export const SERVICE_CATEGORIES: { key: ServiceCategory; label: string; icon: string }[] = [
  { key: 'photography', label: 'Photography', icon: '📸' },
  { key: 'chef', label: 'Private Chef', icon: '👨‍🍳' },
  { key: 'music', label: 'Live Music', icon: '🎵' },
  { key: 'dj', label: 'DJ Set', icon: '🎧' },
  { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { key: 'fitness', label: 'Fitness / Yoga', icon: '💪' },
  { key: 'beauty', label: 'Beauty / Styling', icon: '💄' },
  { key: 'tech', label: 'Tech Support', icon: '💻' },
  { key: 'tutoring', label: 'Tutoring', icon: '📚' },
  { key: 'delivery', label: 'Delivery / Errands', icon: '📦' },
  { key: 'events', label: 'Event Help', icon: '🎪' },
  { key: 'transport', label: 'Transport / Driver', icon: '🚗' },
  { key: 'design', label: 'Design / Creative', icon: '🎨' },
  { key: 'other', label: 'Other', icon: '✨' },
];

export type RequestStatus = 'open' | 'in_progress' | 'fulfilled' | 'cancelled';

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  location: string;
  date: string;
  time?: string;
  budgetMin: number;
  budgetMax: number;
  status: RequestStatus;
  tags: string[];
  image?: string;
  createdAt: string;
  creatorId?: string;
  createdBy: { name: string; avatar: string };
  responders: number; // count of people who've responded
  /** Seconds until the request expires (if time-limited); renders a countdown. */
  expiresIn?: number;
  /** Distance in miles from the viewer (if known). */
  distance?: number;
}

interface ServiceRequestState {
  requests: ServiceRequest[];
  createRequest: (req: Omit<ServiceRequest, 'id' | 'status' | 'createdAt' | 'responders'>) => ServiceRequest;
  grabRequest: (id: string) => void;
  updateRequestStatus: (id: string, status: RequestStatus) => void;
  deleteRequest: (id: string) => void;
  getRequestsByDate: (date: string) => ServiceRequest[];
  getOpenRequests: () => ServiceRequest[];
}

const ServiceRequestContext = createContext<ServiceRequestState | null>(null);

const STORAGE_KEY = 'apparently_service_requests_v1';

// Seed data for instant visibility
const SEED_REQUESTS: ServiceRequest[] = [];

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ServiceRequestProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  // Load requests: backend API (bypasses RLS) → Supabase → AsyncStorage
  useEffect(() => {
    let cancelled = false;
    const mapRow = (row: any): ServiceRequest => ({
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      category: row.category || 'other',
      location: row.location || '',
      date: row.date || '',
      time: row.time || undefined,
      budgetMin: row.budget_min || 0,
      budgetMax: row.budget_max || 0,
      status: row.status || 'open',
      tags: row.tags || [],
      createdAt: row.created_at || new Date().toISOString(),
      creatorId: row.requester_id || row.creator_id || '',
      createdBy: { name: 'Unknown', avatar: '' },
      responders: 0,
      image: row.image_url || undefined,
    });

    const loadRequests = async () => {
      try {
        let liveRequests: ServiceRequest[] = [];

        // 1. Backend API (service key bypasses RLS)
        try {
          const res = await fastFetch(`${getApiUrl()}/api/home-feed`);
          if (res.ok) {
            const json = await res.json();
            if (json.serviceRequests?.length) liveRequests = json.serviceRequests.map(mapRow);
          }
        } catch { /* fall through */ }

        // 2. Fallback: direct Supabase
        if (liveRequests.length === 0) {
          const { data, error } = await supabase
            .from('service_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          if (!error && data?.length) liveRequests = data.map(mapRow);
        }

        if (cancelled) return;

        if (liveRequests.length === 0) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setRequests(JSON.parse(stored));
        } else {
          setRequests(liveRequests);
          try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(liveRequests)); } catch {}
        }
      } catch (e) {
        logger.error('ServiceRequestContext', 'Failed to load requests', { e });
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setRequests(JSON.parse(stored));
        } catch {}
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };
    loadRequests();
    return () => { cancelled = true; };
  }, []);

  // Save requests to AsyncStorage whenever they change (after initial load)
  const saveRequests = useCallback(async (updatedRequests: ServiceRequest[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRequests));
    } catch (e) {
      logger.error('ServiceRequestContext', 'Failed to save requests', { e });
    }
  }, []);

  const createRequest = useCallback(
    (input: Omit<ServiceRequest, 'id' | 'status' | 'createdAt' | 'responders'>): ServiceRequest => {
      const newRequest: ServiceRequest = {
        ...input,
        id: generateId(),
        status: 'open',
        createdAt: new Date().toISOString(),
        responders: 0,
      };
      setRequests((prev) => {
        const updated = [newRequest, ...prev];
        if (isLoaded) saveRequests(updated);
        return updated;
      });
      // Sync to Supabase — use actual DB column names
      supabase.from('service_requests').insert({
        id: newRequest.id,
        requester_id: newRequest.creatorId || '',
        creator_id: newRequest.creatorId || '',
        title: newRequest.title,
        description: sanitizeBundleDesc(newRequest.description),
        category: newRequest.category,
        location: newRequest.location,
        budget: newRequest.budgetMin || newRequest.budgetMax || 0,
        status: newRequest.status,
        created_at: newRequest.createdAt,
        image_url: newRequest.image || null,
      }).then(({ error }) => {
        if (error) logger.error('ServiceRequestContext', 'Supabase insert failed', { error });
      });
      return newRequest;
    },
    [isLoaded, saveRequests]
  );

  /**
   * Service-request "Grab" — the helper who wants to fulfill a request.
   * Mirrors the bundle/skill grab flow:
   *   1. guard own request
   *   2. optimistic responders bump + local save
   *   3. persist as a job_request (requester <-> responder)
   *   4. notify the requester
   *   5. find-or-create the private conversation AND send ONE DM with a service card
   */
  const grabRequest = useCallback((id: string) => {
    const request = requests.find((r) => r.id === id);
    if (request && user?.id && request.creatorId === user.id) {
      logger.warn('ServiceRequestContext', 'Cannot grab own request');
      return;
    }
    // Without a real requester we cannot open a private chat or notify — refuse.
    if (!request?.creatorId || request.creatorId.startsWith('u-') || !user?.id || user.id.startsWith('u-')) {
      logger.warn('ServiceRequestContext', 'Grab skipped: no real requester/responder', { id });
      return;
    }
    setRequests((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, responders: (r.responders || 0) + 1 } : r
      );
      if (isLoaded) saveRequests(updated);
      return updated;
    });
    const budgetAmount = request.budgetMax || request.budgetMin || 0;
    const budgetLabel = request.budgetMax
      ? `$${request.budgetMin}–$${request.budgetMax}`
      : budgetAmount > 0 ? `$${budgetAmount}` : 'TBD';

    // 3. Persist the grab as a job_request so it shows in the responder's "grabbed" list.
    (async () => {
      try {
        const { error } = await supabase.from('job_requests').insert({
          user_id: user.id,
          requester_id: request.creatorId,
          type: 'service_request',
          title: request.title,
          proposed_budget: budgetAmount,
          status: 'pending',
          request_id: request.id,
          plan_details: { category: request.category, description: request.description },
        });
        if (error) logger.warn('ServiceRequestContext', 'job_request insert failed', { error });
      } catch (e) {
        logger.warn('ServiceRequestContext', 'job_request insert exception', { e });
      }
    })();

    // 4 + 5. Notify requester + find-or-create conversation and send ONE grab DM.
    const actorName = user.fullName || user.username || 'Someone';
    const actorAvatar = (user as any)?.avatarUrl || '';
    const serviceCard = {
      type: 'service_card',
      id: request.id,
      title: request.title,
      description: request.description || '',
      category: request.category || '',
      price: budgetAmount || '',
      requester_name: request.createdBy?.name || '',
    };

    supabase.from('notifications').insert({
      user_id: request.creatorId,
      actor_id: user.id,
      actor_name: actorName,
      actor_avatar: actorAvatar,
      type: 'service_grab',
      title: `${actorName} offered to help with "${request.title}"`,
      body: `offered to help with "${request.title}"`,
      data: { request_id: request.id, request_title: request.title, item_id: request.id, item_title: request.title },
      read: false,
      created_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) logger.warn('ServiceRequestContext', 'Notification insert failed', { error });
    });

    (async () => {
      const [a, b] = [user.id, request.creatorId].sort();
      try {
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_one', a)
          .eq('participant_two', b)
          .maybeSingle();
        let conversationId = existing?.id;
        if (!conversationId) {
          const { data: created, error: createErr } = await supabase
            .from('conversations')
            .insert({ participant_one: a, participant_two: b })
            .select('id')
            .single();
          if (createErr) {
            logger.warn('ServiceRequestContext', 'Conversation create failed', { error: createErr });
            return;
          }
          conversationId = created.id;
        }
        if (!conversationId) return;
        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          receiver_id: request.creatorId,
          content: `🛠️ Hey! I can help with "${request.title}". My budget is ${budgetLabel}. Still looking?`,
          metadata: { service_card: serviceCard },
          created_at: new Date().toISOString(),
          read: false,
        });
        if (msgErr) logger.warn('ServiceRequestContext', 'Grab DM insert failed', { error: msgErr });
      } catch (e) {
        logger.warn('ServiceRequestContext', 'Grab DM exception', { e });
      }
    })();
  }, [requests, isLoaded, saveRequests, user?.id, user?.fullName, user?.username]);

  const updateRequestStatus = useCallback((id: string, status: RequestStatus) => {
    setRequests((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, status } : r));
      if (isLoaded) saveRequests(updated);
      return updated;
    });
    // Sync to Supabase
    supabase.from('service_requests').update({ status }).eq('id', id).then(({ error }) => {
      if (error) logger.error('ServiceRequestContext', 'Supabase status update failed', { error });
    });
  }, [isLoaded, saveRequests]);

  const deleteRequest = useCallback((id: string) => {
    setRequests((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      if (isLoaded) saveRequests(updated);
      return updated;
    });
    // Sync to Supabase
    supabase.from('service_requests').delete().eq('id', id).then(({ error }) => {
      if (error) logger.error('ServiceRequestContext', 'Supabase delete failed', { error });
    });
  }, [isLoaded, saveRequests]);

  const getRequestsByDate = useCallback(
    (date: string) => requests.filter((r) => r.date === date),
    [requests]
  );

  const getOpenRequests = useCallback(
    () => requests.filter((r) => r.status === 'open'),
    [requests]
  );

  return (
    <ServiceRequestContext.Provider
      value={{
        requests,
        createRequest,
        grabRequest,
        updateRequestStatus,
        deleteRequest,
        getRequestsByDate,
        getOpenRequests,
      }}
    >
      {children}
    </ServiceRequestContext.Provider>
  );
}

export function useServiceRequests(): ServiceRequestState {
  const ctx = useContext(ServiceRequestContext);
  if (!ctx) throw new Error('useServiceRequests must be used within ServiceRequestProvider');
  return ctx;
}
