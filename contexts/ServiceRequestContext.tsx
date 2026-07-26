import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  createdAt: string;
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
const SEED_REQUESTS: ServiceRequest[] = [
  {
    id: 'req-1',
    title: 'Need a photographer for rooftop party',
    description: 'Looking for a photographer to capture our rooftop party in Brooklyn. 3-4 hours, need both candid and posed shots.',
    category: 'photography',
    location: 'Williamsburg, Brooklyn',
    date: '2026-07-26',
    time: '7:00 PM',
    budgetMin: 150,
    budgetMax: 300,
    status: 'open',
    tags: ['Photography', 'Events', 'Nightlife'],
    createdAt: new Date().toISOString(),
    createdBy: { name: 'Marcus J.', avatar: '' },
    responders: 3,
  },
  {
    id: 'req-2',
    title: 'Private chef for Sunday brunch (6 people)',
    description: 'Want a chef to come cook brunch at my apartment in SoHo. 6 guests, prefer farm-to-table style.',
    category: 'chef',
    location: 'SoHo, Manhattan',
    date: '2026-07-27',
    time: '11:00 AM',
    budgetMin: 200,
    budgetMax: 500,
    status: 'open',
    tags: ['Food', 'Brunch', 'Private'],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    createdBy: { name: 'Priya K.', avatar: '' },
    responders: 5,
  },
  {
    id: 'req-3',
    title: 'DJ for Friday night house party',
    description: 'Need a DJ who can play house/techno for a private party. Equipment provided, just bring USB. 10PM-2AM.',
    category: 'dj',
    location: 'Bushwick, Brooklyn',
    date: '2026-07-25',
    time: '10:00 PM',
    budgetMin: 300,
    budgetMax: 600,
    status: 'open',
    tags: ['Music', 'DJ', 'Nightlife'],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    createdBy: { name: 'Alex T.', avatar: '' },
    responders: 7,
  },
  {
    id: 'req-4',
    title: 'House cleaner for studio apartment',
    description: 'Need a deep clean of my studio apartment before I move out. Kitchen, bathroom, floors, windows.',
    category: 'cleaning',
    location: 'East Village, Manhattan',
    date: '2026-07-28',
    time: '9:00 AM',
    budgetMin: 80,
    budgetMax: 150,
    status: 'open',
    tags: ['Cleaning', 'Move-out'],
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    createdBy: { name: 'Jordan L.', avatar: '' },
    responders: 2,
  },
];

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ServiceRequestProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<ServiceRequest[]>(SEED_REQUESTS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted requests from AsyncStorage on mount, merge with seed data by ID
  useEffect(() => {
    const loadRequests = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: ServiceRequest[] = JSON.parse(stored);
          const storedIds = new Set(parsed.map((r) => r.id));
          const merged = [
            ...parsed,
            ...SEED_REQUESTS.filter((r) => !storedIds.has(r.id)),
          ];
          setRequests(merged);
        }
      } catch (e) {
        logger.error('ServiceRequestContext', 'Failed to load requests', { e });
      } finally {
        setIsLoaded(true);
      }
    };
    loadRequests();
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
  }, [isLoaded, saveRequests]);

  const deleteRequest = useCallback((id: string) => {
    setRequests((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      if (isLoaded) saveRequests(updated);
      return updated;
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
