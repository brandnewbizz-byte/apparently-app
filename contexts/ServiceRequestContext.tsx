import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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
}

interface ServiceRequestState {
  requests: ServiceRequest[];
  createRequest: (req: Omit<ServiceRequest, 'id' | 'status' | 'createdAt' | 'responders'>) => ServiceRequest;
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

  // Load requests from Supabase on mount (live backend)
  useEffect(() => {
    let cancelled = false;
    const loadRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          logger.error('ServiceRequestContext', 'Failed to fetch from Supabase', { error });
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setRequests(JSON.parse(stored));
          return;
        }

        const liveRequests: ServiceRequest[] = (data || []).map((row: any) => ({
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
          creatorId: row.creator_id || '',
          createdBy: { name: row.creator_name || 'Unknown', avatar: row.creator_avatar || '' },
          responders: row.responders || 0,
          image: row.image_url || undefined,
        }));

        setRequests(liveRequests);
        try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(liveRequests)); } catch {}
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
      // Sync to Supabase
      supabase.from('service_requests').insert({
        id: newRequest.id,
        title: newRequest.title,
        description: newRequest.description,
        category: newRequest.category,
        location: newRequest.location,
        date: newRequest.date,
        time: newRequest.time,
        budget_min: newRequest.budgetMin,
        budget_max: newRequest.budgetMax,
        status: newRequest.status,
        created_by: newRequest.createdBy.name,
        creator_id: newRequest.creatorId || '',
        created_at: newRequest.createdAt,
        responders: 0,
        image_url: newRequest.image || null,
      }).then(({ error }) => {
        if (error) logger.error('ServiceRequestContext', 'Supabase insert failed', { error });
      });
      return newRequest;
    },
    [isLoaded, saveRequests]
  );

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
