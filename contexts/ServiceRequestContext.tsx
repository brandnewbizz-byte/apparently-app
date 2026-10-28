import React, { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeBundleDesc } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { uuid } from '@/lib/uuid';
import { localDateKey } from '@/lib/dates';
import { isLocalFileUri } from '@/lib/media';
import { persistableImageUri } from '@/lib/storage';

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
  | 'assistant'
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
  { key: 'assistant', label: 'Virtual Assistant', icon: '🧑‍💻' },
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
  /** 'request' = posted from the planner's Requests tab (service_requests);
   *  'job' = help added in "Plan my day" (job_requests: chauffeur, assistant…). */
  source?: 'request' | 'job';
  /** For jobs: the raw job type (chauffeur, va, errands, driver, other). */
  jobType?: string;
  /** For jobs: the plan it belongs to. */
  planId?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  paymentMethod?: string;
}

export interface GrabOutcome {
  ok: boolean;
  reason?: 'own' | 'taken' | 'already_grabbed' | 'not_signed_in' | 'not_found' | 'error';
}

interface ServiceRequestState {
  requests: ServiceRequest[];
  createRequest: (req: Omit<ServiceRequest, 'id' | 'status' | 'createdAt' | 'responders'>) => ServiceRequest;
  /** Offer to help / take the job. Resolves once it's recorded. */
  grabRequest: (id: string) => Promise<GrabOutcome>;
  /** Re-fetch from the server (Home pull-to-refresh, Manage focus). */
  reload: () => Promise<void>;
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
  return uuid();
}

// job_requests status ⇄ request status
const JOB_STATUS_TO: Record<string, RequestStatus> = {
  pending: 'open', accepted: 'in_progress', in_progress: 'in_progress', completed: 'fulfilled', cancelled: 'cancelled',
};
const JOB_STATUS_FROM: Record<RequestStatus, string> = {
  open: 'pending', in_progress: 'in_progress', fulfilled: 'completed', cancelled: 'cancelled',
};
// service_requests allows open | in_progress | completed | cancelled
const REQ_STATUS_FROM: Record<RequestStatus, string> = {
  open: 'open', in_progress: 'in_progress', fulfilled: 'completed', cancelled: 'cancelled',
};
const REQ_STATUS_TO: Record<string, RequestStatus> = {
  open: 'open', in_progress: 'in_progress', completed: 'fulfilled', fulfilled: 'fulfilled', cancelled: 'cancelled',
};
const JOB_CATEGORY: Record<string, ServiceCategory> = {
  chauffeur: 'transport', driver: 'delivery', errands: 'delivery', va: 'assistant', other: 'other',
};
const JOB_LABEL: Record<string, string> = {
  chauffeur: 'Chauffeur', driver: 'Delivery', errands: 'Errand runner', va: 'Virtual assistant', other: 'Help needed',
};

function num(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function mapRequestRow(row: any): ServiceRequest {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    category: row.category || 'other',
    location: row.location || '',
    date: row.date || '',
    time: row.time || undefined,
    budgetMin: num(row.budget_min),
    budgetMax: num(row.budget_max) || num(row.budget),
    status: REQ_STATUS_TO[row.status] || 'open',
    tags: row.tags || [],
    createdAt: row.created_at || new Date().toISOString(),
    creatorId: row.requester_id || row.creator_id || '',
    createdBy: { name: 'Someone', avatar: '' },
    responders: 0,
    image: row.image_url || undefined,
    source: 'request',
  };
}

/** Help added in "Plan my day" (chauffeur, assistant, errands, delivery…). */
function mapJobRow(row: any): ServiceRequest {
  const type = row.type || 'other';
  const tasks = row.tasks || {};
  const label = JOB_LABEL[type] || 'Help needed';
  const pickup = row.pickup_location || '';
  const dropoff = row.dropoff_location || '';
  let title = label;
  if (type === 'chauffeur' || type === 'driver') {
    if (pickup && dropoff) title = `${label}: ${pickup} → ${dropoff}`;
    else if (pickup || dropoff) title = `${label}: ${pickup || dropoff}`;
  } else if (type === 'va' && row.hours) {
    title = `${label} · ${row.hours} hr${row.hours === '1' ? '' : 's'}`;
  } else if (row.description && !/request$/i.test(row.description)) {
    title = `${label}: ${row.description}`;
  }
  const details = [
    row.description && !/request$/i.test(row.description) ? row.description : null,
    Array.isArray(tasks.task_types) && tasks.task_types.length ? `Tasks: ${tasks.task_types.join(', ')}` : null,
    tasks.round_trip ? 'Round trip' : null,
    row.notes || null,
  ].filter(Boolean).join(' · ');
  const budget = num(tasks.budget);
  return {
    id: row.id,
    title: title.length > 80 ? `${title.slice(0, 77)}…` : title,
    description: details,
    category: JOB_CATEGORY[type] || 'other',
    location: pickup || tasks.location || '',
    date: tasks.date || '',
    time: row.pickup_time || undefined,
    budgetMin: 0,
    budgetMax: budget,
    status: JOB_STATUS_TO[row.status] || 'open',
    tags: [label, row.payment_method ? `Pays by ${row.payment_method}` : null].filter(Boolean) as string[],
    createdAt: row.created_at || new Date().toISOString(),
    creatorId: row.user_id || '',
    createdBy: { name: 'Someone', avatar: '' },
    responders: row.accepted_by ? 1 : 0,
    image: row.image || undefined,
    source: 'job',
    jobType: type,
    planId: row.plan_id || undefined,
    pickupLocation: pickup || undefined,
    dropoffLocation: dropoff || undefined,
    paymentMethod: row.payment_method || undefined,
  };
}

export function ServiceRequestProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  const myId = user?.id || '';
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Everything that can show on Home's "Service Requests" deck:
   *  • requests posted from the planner (service_requests)
   *  • help added while planning a day — chauffeur, assistant, errands,
   *    delivery (job_requests). These used to only live on the job board.
   * Plus your own of both kinds, so the planner can show and manage them.
   */
  const loadRequests = useCallback(async () => {
    try {
      const today = localDateKey();
      const [reqRes, jobRes] = await Promise.all([
        supabase.from('service_requests').select('*').order('created_at', { ascending: false }).limit(100),
        supabase
          .from('job_requests')
          .select('*')
          .or(myId ? `user_id.eq.${myId},and(status.eq.pending,accepted_by.is.null)` : 'and(status.eq.pending,accepted_by.is.null)')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (reqRes.error) logger.warn('ServiceRequestContext', 'service_requests load failed', { error: reqRes.error.message });
      if (jobRes.error) logger.warn('ServiceRequestContext', 'job_requests load failed', { error: jobRes.error.message });

      const fromRequests = (reqRes.data || []).map(mapRequestRow);
      const fromJobs = (jobRes.data || []).map(mapJobRow);

      // Other people's open items only if they're not in the past.
      const isLive = (r: ServiceRequest) => r.creatorId === myId || r.status !== 'open' || !r.date || r.date >= today;
      const all = [...fromRequests, ...fromJobs]
        .filter((r) => r.creatorId === myId || (r.status === 'open' && isLive(r)))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      // Real names/avatars for requesters (the rows only carry ids).
      const ids = [...new Set(all.map((r) => r.creatorId).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', ids);
        const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
        for (const r of all) {
          const p: any = r.creatorId ? byId.get(r.creatorId) : null;
          if (p) r.createdBy = { name: p.full_name || p.username || 'Someone', avatar: p.avatar || '' };
        }
      }

      // Keep responder counts we bumped locally this session.
      setRequests((prev) => {
        const resp = new Map(prev.map((r) => [r.id, r.responders]));
        return all.map((r) => ({ ...r, responders: Math.max(r.responders, resp.get(r.id) || 0) }));
      });
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
    } catch (e) {
      logger.error('ServiceRequestContext', 'Failed to load requests', { e });
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setRequests((prev) => (prev.length ? prev : JSON.parse(stored)));
      } catch {}
    } finally {
      setIsLoaded(true);
    }
  }, [myId]);

  // Load on start and whenever the signed-in account changes.
  useEffect(() => { loadRequests(); }, [loadRequests]);

  // New requests from anyone show up without restarting the app.
  useEffect(() => {
    const schedule = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => { loadRequests(); }, 600);
    };
    const channel = supabase
      .channel(`service-requests-${myId || 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_requests' }, schedule)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [myId, loadRequests]);

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
      // Sync to Supabase — use actual DB column names. Local photos are
      // uploaded first so other people can see the thumbnail.
      (async () => {
        const ownerId = newRequest.creatorId || user?.id;
        if (!ownerId) { logger.warn('ServiceRequestContext', 'Not signed in — request kept on this device only'); return; }
        let imageUrl: string | null = newRequest.image || null;
        if (imageUrl && isLocalFileUri(imageUrl)) {
          imageUrl = (await persistableImageUri(imageUrl, 'user-media', `requests/${ownerId}`)) || null;
        }
        const { error } = await supabase.from('service_requests').insert({
          id: newRequest.id,
          requester_id: ownerId,
          creator_id: ownerId,
          title: newRequest.title,
          description: sanitizeBundleDesc(newRequest.description),
          category: newRequest.category,
          location: newRequest.location,
          budget: newRequest.budgetMax || newRequest.budgetMin || 0,
          budget_min: newRequest.budgetMin || null,
          budget_max: newRequest.budgetMax || null,
          date: newRequest.date || null,
          time: newRequest.time || null,
          tags: newRequest.tags || [],
          status: newRequest.status,
          created_at: newRequest.createdAt,
          image_url: imageUrl,
        });
        if (error) logger.error('ServiceRequestContext', 'Supabase insert failed', { error });
      })();
      return newRequest;
    },
    [isLoaded, saveRequests, user?.id]
  );

  /**
   * Grab a request = offer to help (service_requests, many helpers can offer)
   * or take the job (job_requests, first helper wins via accept_job_request).
   * Records a user_grabs row (your "booked" list) and notifies the requester
   * as a service_grab (shows in their Manage → Orders). The chat message with
   * the request card is sent by the caller so it can open the conversation.
   */
  const grabRequest = useCallback(async (id: string): Promise<GrabOutcome> => {
    const request = requests.find((r) => r.id === id);
    if (!request) return { ok: false, reason: 'not_found' };
    if (!user?.id || user.id.startsWith('u-')) return { ok: false, reason: 'not_signed_in' };
    if (!request.creatorId || request.creatorId.startsWith('u-')) return { ok: false, reason: 'not_found' };
    if (request.creatorId === user.id) return { ok: false, reason: 'own' };

    if (request.source === 'job') {
      const { data, error } = await supabase.rpc('accept_job_request', { p_job: id });
      if (error) {
        // Function not deployed yet: try the direct update (works once the
        // accept policy matches 'pending').
        const { data: rows, error: upErr } = await supabase
          .from('job_requests')
          .update({ status: 'accepted', accepted_by: user.id, accepted_by_name: user.fullName || user.username || 'Helper', accepted_by_avatar: user.avatar || '' })
          .eq('id', id)
          .eq('status', 'pending')
          .is('accepted_by', null)
          .select('id');
        if (upErr || !rows?.length) {
          logger.warn('ServiceRequestContext', 'accept job failed', { error: error.message, upErr: upErr?.message });
          return { ok: false, reason: 'error' };
        }
      } else {
        const res = data as { ok: boolean; reason?: string };
        if (!res?.ok) {
          const reason = res?.reason === 'own_request' ? 'own' : (res?.reason as GrabOutcome['reason']) || 'error';
          if (reason === 'taken') setRequests((prev) => prev.filter((r) => r.id !== id));
          return { ok: false, reason };
        }
      }
    }

    const budgetAmount = request.budgetMax || request.budgetMin || 0;
    const now = new Date().toISOString();
    const { error: grabErr } = await supabase.from('user_grabs').insert({
      user_id: user.id,
      provider_id: request.creatorId,
      item_id: request.id,
      // user_grabs.item_type only allows bundle | deal | job | listing.
      item_type: request.source === 'job' ? 'job' : 'listing',
      title: request.title,
      price: budgetAmount,
      status: request.source === 'job' ? 'confirmed' : 'pending',
      provider_name: request.createdBy?.name || '',
      provider_avatar: request.createdBy?.avatar || '',
      created_at: now,
      updated_at: now,
      booked_at: now,
    });
    if (grabErr) {
      if (grabErr.code === '23505' && request.source !== 'job') return { ok: false, reason: 'already_grabbed' };
      if (grabErr.code !== '23505') logger.warn('ServiceRequestContext', 'user_grabs insert failed', { error: grabErr.message });
    }

    // Jobs are taken (one helper); requests stay open for more offers.
    setRequests((prev) => {
      const updated = request.source === 'job'
        ? prev.filter((r) => r.id !== id)
        : prev.map((r) => (r.id === id ? { ...r, responders: (r.responders || 0) + 1 } : r));
      if (isLoaded) saveRequests(updated);
      return updated;
    });

    const actorName = user.fullName || user.username || 'Someone';
    const budgetLabel = request.budgetMin && request.budgetMax
      ? `$${request.budgetMin}–$${request.budgetMax}`
      : budgetAmount > 0 ? `$${budgetAmount}` : '';
    supabase.from('notifications').insert({
      user_id: request.creatorId,
      actor_id: user.id,
      actor_name: actorName,
      actor_avatar: user.avatar || '',
      // notifications.type has no 'service_grab'; 'service_response' is the allowed one.
      type: 'service_response',
      title: request.source === 'job' ? `${actorName} took your request "${request.title}"` : `${actorName} offered to help with "${request.title}"`,
      body: request.source === 'job' ? `took your request "${request.title}"` : `offered to help with "${request.title}"`,
      data: {
        request_id: request.id,
        request_title: request.title,
        item_id: request.id,
        item_title: request.title,
        request_image: request.image || '',
        request_price: budgetLabel,
        price: budgetAmount || undefined,
        source: request.source || 'request',
        job_type: request.jobType,
        plan_id: request.planId,
      },
      read: false,
      created_at: now,
    }).then(({ error }) => {
      if (error) logger.warn('ServiceRequestContext', 'Notification insert failed', { error });
    });

    return { ok: true };
  }, [requests, isLoaded, saveRequests, user]);

  const updateRequestStatus = useCallback((id: string, status: RequestStatus) => {
    setRequests((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, status } : r));
      if (isLoaded) saveRequests(updated);
      return updated;
    });
    // Sync to Supabase
    const target = requests.find((r) => r.id === id);
    const req = target?.source === 'job'
      ? supabase.from('job_requests').update({ status: JOB_STATUS_FROM[status] }).eq('id', id)
      : supabase.from('service_requests').update({ status: REQ_STATUS_FROM[status] }).eq('id', id);
    req.then(({ error }) => {
      if (error) logger.error('ServiceRequestContext', 'Supabase status update failed', { error });
    });
  }, [isLoaded, saveRequests, requests]);

  const deleteRequest = useCallback((id: string) => {
    setRequests((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      if (isLoaded) saveRequests(updated);
      return updated;
    });
    // Sync to Supabase
    const target = requests.find((r) => r.id === id);
    supabase.from(target?.source === 'job' ? 'job_requests' : 'service_requests').delete().eq('id', id).then(({ error }) => {
      if (error) logger.error('ServiceRequestContext', 'Supabase delete failed', { error });
    });
  }, [isLoaded, saveRequests, requests]);

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
        reload: loadRequests,
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
