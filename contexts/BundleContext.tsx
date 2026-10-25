import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getApiUrl, fastFetch } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { sanitizeBundleDesc, sanitizeCaption } from '@/lib/sanitize';
import { isVideoUrl } from '@/lib/media';
import { uuid } from '@/lib/uuid';

// ── Types ──────────────────────────────────────────────────────────────────

export const MAX_BUNDLES = 50;

export interface BundleItem {
  id: string;
  name: string;
  description?: string; // per-item description
  category: string;
  provider: string;
  providerAvatar: string;
  providerLink?: string;
  price: number;
  icon: string; // emoji
  deliveryNotes?: string;
  resourcesNeeded?: string;
}

export interface UserBundle {
  id: string;
  title: string;
  description: string;
  price: number;
  items: BundleItem[];
  imageUrl: string;
  category: string;
  location: string;
  dateRange: string;
  tags: string[];
  creatorId?: string;
  creator: { name: string; avatar: string; rating: number; reviews: number };
  status: 'available' | 'grabbed' | 'fulfilled' | 'active' | 'draft' | 'published';
  grabCount: number;
  createdAt: string;
  availableCount: number;
  plannerNotes?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
}

interface BundleContextValue {
  bundles: UserBundle[];
  myBundles: UserBundle[];
  createBundle: (bundle: Omit<UserBundle, 'id' | 'createdAt' | 'status' | 'grabCount'>) => { success: boolean; error?: string };
  updateBundle: (id: string, patch: Partial<UserBundle>) => void;
  /** Claims one spot. Fails when the bundle is full, already grabbed by you, or your own. */
  grabBundle: (id: string) => Promise<GrabResult>;
  deleteBundle: (id: string) => void;
}

export interface GrabResult {
  ok: boolean;
  reason?: 'full' | 'already_grabbed' | 'own_bundle' | 'not_found' | 'error';
  spotsLeft?: number;
}

/** How many more people can grab this bundle. */
export function spotsLeft(b: Pick<UserBundle, 'availableCount' | 'grabCount'>): number {
  return Math.max((b.availableCount || 1) - (b.grabCount || 0), 0);
}

const BundleContext = createContext<BundleContextValue | undefined>(undefined);

const STORAGE_KEY = 'apparently_bundles_v1';

// ── Seed Data ──────────────────────────────────────────────────────────────

// No seed data — all bundles now come from live Supabase.
const SEED_BUNDLES: UserBundle[] = [];

// ── Provider ───────────────────────────────────────────────────────────────

export function BundleProvider({ children }: { children: React.ReactNode }) {
  const [bundles, setBundles] = useState<UserBundle[]>(SEED_BUNDLES);
  const [myBundles, setMyBundles] = useState<UserBundle[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  // Load bundles: backend API (bypasses RLS) → Supabase → AsyncStorage
  useEffect(() => {
    let cancelled = false;
    const mapRow = (row: any): UserBundle => {
      const rawImage = row.image || row.cover_image || '';
      const isVideo = isVideoUrl(rawImage);
      return {
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        price: row.bundle_price ?? row.price ?? 0,
        items: row.items || row.services || [],
        imageUrl: isVideo ? '' : rawImage,
        videoUrl: isVideo ? rawImage : undefined,
        mediaType: isVideo ? 'video' : 'image',
        category: row.category || '',
        location: row.location || '',
        dateRange: row.expires_at || '',
        tags: row.tags || [],
        creatorId: row.user_id || row.creator_id || '',
        creator: { name: row.provider_name || 'Unknown', avatar: row.provider_avatar || '', rating: 0, reviews: 0 },
        status: row.status || 'available',
        grabCount: row.grabs ?? row.grab_count ?? 0,
        createdAt: row.created_at || new Date().toISOString(),
        // Number of people who can grab this bundle (set by the creator).
        availableCount: Math.max(Number(row.available_count) || 1, 1),
      };
    };

    const loadBundles = async () => {
      try {
        let liveBundles: UserBundle[] = [];

        // 1. Try backend API (service key bypasses RLS)
        try {
          const res = await fastFetch(`${getApiUrl()}/api/home-feed`);
          if (res.ok) {
            const json = await res.json();
            if (json.bundles?.length) {
              liveBundles = json.bundles.map(mapRow);
            }
          }
        } catch { /* fall through to Supabase */ }

        // 2. Fallback: direct Supabase (anon key, may be RLS-blocked)
        if (liveBundles.length === 0) {
          const { data, error } = await supabase
            .from('bundles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          if (!error && data?.length) liveBundles = data.map(mapRow);
        }

        if (cancelled) return;

        // 3. Final fallback: AsyncStorage
        if (liveBundles.length === 0) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            const cached = JSON.parse(stored);
            setBundles(cached);
            setMyBundles(cached);
          }
        } else {
          setBundles(liveBundles);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          setMyBundles(liveBundles.filter((b) => b.creatorId === (authUser?.id || '')));
          try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(liveBundles)); } catch {}
        }
      } catch (e) {
        logger.error('BundleContext', 'Failed to load bundles', { e });
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setBundles(JSON.parse(stored));
        } catch {}
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };
    loadBundles();
    return () => { cancelled = true; };
  }, []);

  // Save bundles to AsyncStorage whenever they change (after initial load)
  const saveBundles = useCallback(async (updatedBundles: UserBundle[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBundles));
    } catch (e) {
      logger.error('BundleContext', 'Failed to save bundles', { e });
    }
  }, []);

  const createBundle = useCallback((bundle: Omit<UserBundle, 'id' | 'createdAt' | 'status' | 'grabCount'>) => {
    if (myBundles.length >= MAX_BUNDLES) {
      return { success: false, error: `You can only have up to ${MAX_BUNDLES} bundles posted at once.` };
    }
    const newBundle: UserBundle = {
      ...bundle,
      id: uuid(),
      createdAt: new Date().toISOString(),
      status: 'available',
      grabCount: 0,
    };
    setBundles((prev) => {
      const updated = [newBundle, ...prev];
      if (isLoaded) saveBundles(updated);
      return updated;
    });
    setMyBundles((prev) => [newBundle, ...prev]);
    // Sync to Supabase — use actual DB column names
    const bundleRow: Record<string, unknown> = {
      id: newBundle.id,
      user_id: newBundle.creatorId,
      type: 'bundle',
      title: newBundle.title,
      description: sanitizeBundleDesc(newBundle.description),
      bundle_price: newBundle.price,
      items: newBundle.items,
      creator_id: newBundle.creatorId,
      image: newBundle.mediaType === 'video' ? '' : newBundle.imageUrl,
      cover_image: newBundle.mediaType === 'video' ? (newBundle.videoUrl || '') : newBundle.imageUrl,
      category: newBundle.category || 'lifestyle',
      location: newBundle.location || '',
      provider_name: newBundle.creator?.name || '',
      provider_avatar: newBundle.creator?.avatar || '',
      status: 'draft',
      grabs: 0,
      available_count: Math.max(Math.floor(newBundle.availableCount || 1), 1),
      created_at: newBundle.createdAt,
    };
    supabase.from('bundles').insert(bundleRow).then(({ error }) => {
      if (!error) return;
      // Database without the available_count column yet (migration 020):
      // save the bundle anyway rather than losing it.
      if (String(error.message || '').includes('available_count')) {
        const { available_count: _omit, ...rest } = bundleRow;
        supabase.from('bundles').insert(rest).then(({ error: retryErr }) => {
          if (retryErr) logger.error('BundleContext', 'Supabase insert failed', { error: retryErr });
        });
        return;
      }
      logger.error('BundleContext', 'Supabase insert failed', { error });
    });
    return { success: true };
  }, [isLoaded, saveBundles, myBundles.length]);

  const updateBundle = useCallback((id: string, patch: Partial<UserBundle>) => {
    setBundles((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
      if (isLoaded) saveBundles(updated);
      return updated;
    });
    setMyBundles((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    // Sync to Supabase — use actual DB column names
    const dbPatch: Record<string, any> = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.description !== undefined) dbPatch.description = sanitizeBundleDesc(patch.description);
    if (patch.price !== undefined) dbPatch.bundle_price = patch.price;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.imageUrl !== undefined) { dbPatch.image = patch.imageUrl; dbPatch.cover_image = patch.imageUrl; }
    if (patch.videoUrl !== undefined) { dbPatch.image = ''; dbPatch.cover_image = patch.videoUrl; }
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.availableCount !== undefined) {
      const spots = Math.max(Math.floor(patch.availableCount) || 1, 1);
      dbPatch.available_count = spots;
      // Raising the limit re-opens a full bundle; lowering it can close one.
      const current = bundles.find((b) => b.id === id);
      if (current) dbPatch.status = (current.grabCount || 0) >= spots ? 'grabbed' : (current.status === 'grabbed' ? 'available' : current.status);
    }
    supabase.from('bundles').update(dbPatch).eq('id', id).then(({ error }) => {
      if (error) logger.error('BundleContext', 'Supabase update failed', { error });
    });
  }, [isLoaded, saveBundles, bundles]);

  const grabBundle = useCallback(async (id: string): Promise<GrabResult> => {
    const bundle = bundles.find((b) => b.id === id);
    if (bundle && user?.id && bundle.creatorId === user.id) {
      logger.warn('BundleContext', 'Cannot grab own bundle');
      return { ok: false, reason: 'own_bundle' };
    }

    // Claim a spot on the server (atomic — two people can't take the last
    // spot). Falls back to a client-side check on databases without the
    // grab_bundle function.
    let newGrabCount = (bundle?.grabCount || 0) + 1;
    const capacity = Math.max(bundle?.availableCount || 1, 1);
    const { data: claim, error: claimErr } = await supabase.rpc('grab_bundle', { p_bundle: id });
    if (!claimErr && claim) {
      const res = claim as { ok: boolean; reason?: GrabResult['reason']; grabs?: number; spots_left?: number };
      if (!res.ok) {
        if (res.reason === 'full') {
          setBundles((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'grabbed' as const, grabCount: res.grabs ?? b.grabCount } : b)));
        }
        return { ok: false, reason: res.reason || 'error', spotsLeft: res.spots_left };
      }
      newGrabCount = res.grabs ?? newGrabCount;
    } else {
      if (bundle && spotsLeft(bundle) <= 0) return { ok: false, reason: 'full', spotsLeft: 0 };
      supabase.rpc('increment_deal_stat', { p_kind: 'bundle', p_id: id, p_column: 'grabs' }).then(({ error: rpcErr }) => {
        if (!rpcErr) return;
        supabase
          .from('bundles')
          .update({ grabs: newGrabCount, ...(newGrabCount >= capacity ? { status: 'grabbed' } : {}) })
          .eq('id', id)
          .then(({ error }) => {
            if (error) logger.error('BundleContext', 'Supabase grab update failed', { error });
          });
      });
    }

    // Only a full bundle is marked 'grabbed' (which removes it from discovery).
    setBundles((prev) => {
      const updated = prev.map((b) =>
        b.id === id
          ? { ...b, grabCount: newGrabCount, status: newGrabCount >= Math.max(b.availableCount || 1, 1) ? ('grabbed' as const) : b.status }
          : b
      );
      if (isLoaded) saveBundles(updated);
      return updated;
    });

    // Create inbox notification AND auto-create DM for the bundle owner
    if (bundle?.creatorId && user?.id && bundle.creatorId !== user.id) {
      const grabMessage = `👋 I'm interested in your bundle "${bundle.title}" — let's chat!`;
      // 1. Persist the grab as a user_grabs row (responder's "grabbed" list).
      (async () => {
        try {
          const now = new Date().toISOString();
          const { error } = await supabase.from('user_grabs').insert({
            user_id: user.id,
            provider_id: bundle.creatorId,
            item_id: bundle.id,
            item_type: 'bundle',
            title: bundle.title,
            price: Number(bundle.price || 0),
            status: 'pending',
            provider_name: bundle.creator?.name || '',
            created_at: now,
            updated_at: now,
            booked_at: now,
          });
          if (error) logger.warn('BundleContext', 'user_grabs insert failed', { error });
        } catch (e) {
          logger.warn('BundleContext', 'user_grabs insert exception', { e });
        }
      })();
      // 2. Notification (DB columns: user_id, actor_id, actor_name, actor_avatar, data)
      const actorName = user.fullName || user.username || 'Someone';
      const actorAvatar = user.avatar || '';
      supabase.from('notifications').insert({
        user_id: bundle.creatorId,
        actor_id: user.id,
        actor_name: actorName,
        actor_avatar: actorAvatar,
        type: 'bundle_grab',
        title: `${actorName} grabbed your bundle "${bundle.title}"`,
        body: `grabbed your bundle "${bundle.title}"`,
        data: {
          bundle_id: id,
          bundle_title: bundle.title,
          bundle_image: bundle.imageUrl || '',
          bundle_price: Number(bundle.price || 0),
        },
        read: false,
        created_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) logger.warn('BundleContext', 'Notification insert failed', { error });
      });
      // 2. Find or create a conversation between these two users
      (async () => {
        const [a, b] = [user.id, bundle.creatorId].sort();
        // Look for existing conversation
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_one', a)
          .eq('participant_two', b)
          .maybeSingle();
        let conversationId = existing?.id;
        if (!conversationId) {
          // Create new conversation
          const { data: created, error: createErr } = await supabase
            .from('conversations')
            .insert({
              participant_one: a,
              participant_two: b,
            })
            .select('id')
            .single();
          if (createErr) {
            logger.warn('BundleContext', 'Conversation create failed', { error: createErr });
            return;
          }
          conversationId = created.id;
        }
        // 3. Insert the grab message into the conversation with bundle card metadata
        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          // receiver_id lets the owner get this DM live + counted as unread.
          receiver_id: bundle.creatorId,
          content: grabMessage,
          created_at: new Date().toISOString(),
          read: false,
        });
        if (msgErr) logger.warn('BundleContext', 'Grab DM message insert failed', { error: msgErr });
      })();
    }
    return { ok: true, spotsLeft: Math.max(capacity - newGrabCount, 0) };
  }, [isLoaded, saveBundles, user?.id, user?.fullName, user?.username, user?.avatar, bundles]);

  const deleteBundle = useCallback((id: string) => {
    setBundles((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      if (isLoaded) saveBundles(updated);
      return updated;
    });
    setMyBundles((prev) => prev.filter((b) => b.id !== id));
    // Sync to Supabase
    supabase.from('bundles').delete().eq('id', id).then(({ error }) => {
      if (error) logger.error('BundleContext', 'Supabase delete failed', { error });
    });
  }, [isLoaded, saveBundles]);

  const value = useMemo(
    () => ({ bundles, myBundles, createBundle, updateBundle, grabBundle, deleteBundle }),
    [bundles, myBundles, createBundle, updateBundle, grabBundle, deleteBundle]
  );

  return <BundleContext.Provider value={value}>{children}</BundleContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useBundles(): BundleContextValue {
  const ctx = useContext(BundleContext);
  if (!ctx) throw new Error('useBundles must be used within BundleProvider');
  return ctx;
}
