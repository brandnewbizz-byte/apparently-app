import React, { useRef, createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromDbDealStatus, toDbDealStatus } from '@/lib/dealStatus';
import { supabase } from '@/lib/supabase';
import { getApiUrl, fastFetch } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { sanitizeBundleDesc, sanitizeCaption } from '@/lib/sanitize';
import { isVideoUrl } from '@/lib/media';
import { uuid } from '@/lib/uuid';
import { writeWithFallback } from '@/lib/dbWrite';

/** Columns added after launch; writes retry without them on older databases. */
const NEW_BUNDLE_COLUMNS = ['tags', 'date_range', 'available_count', 'total_value'];

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
  /** Re-fetch from the server. */
  reload: () => Promise<void>;
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
  const reloadRef = useRef(0);
  const reload = useCallback(async () => {
    const run = ++reloadRef.current;
    const cancelledNow = () => run !== reloadRef.current;
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
        dateRange: row.date_range || '',
        tags: row.tags || [],
        creatorId: row.user_id || row.creator_id || '',
        creator: { name: row.provider_name || 'Unknown', avatar: row.provider_avatar || '', rating: 0, reviews: 0 },
        status: fromDbDealStatus(row.status, Number(row.grabs ?? row.grab_count ?? 0), Math.max(Number(row.available_count) || 1, 1)),
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

        if (cancelledNow()) return;

        // 3. Final fallback: AsyncStorage
        if (liveBundles.length === 0) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            const cached = JSON.parse(stored);
            setBundles(cached);
            const { data: { user: cu } } = await supabase.auth.getUser();
            setMyBundles(cached.filter((x: any) => x.creatorId === (cu?.id || '')));
          }
        } else {
          // Rows don't carry the creator's name/avatar — look them up.
          try {
            const ids = [...new Set(liveBundles.map((x) => x.creatorId).filter(Boolean))];
            if (ids.length) {
              const { data: profs } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', ids);
              const byId = new Map((profs || []).map((p: any) => [p.id, p]));
              for (const x of liveBundles) {
                const pr: any = byId.get(x.creatorId || '');
                if (pr) x.creator = { ...x.creator, name: x.creator?.name && x.creator.name !== 'Unknown' ? x.creator.name : (pr.full_name || pr.username || 'Someone'), avatar: x.creator?.avatar || pr.avatar || '' };
              }
            }
          } catch { /* names are optional */ }
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
        if (!cancelledNow()) setIsLoaded(true);
      }
    };
    await loadBundles();
  }, []);

  // Load on start and again when the signed-in account changes.
  useEffect(() => { reload(); }, [reload, user?.id]);

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
      status: 'active',
      grabs: 0,
      available_count: Math.max(Math.floor(newBundle.availableCount || 1), 1),
      total_value: (newBundle.items || []).reduce((sum, it) => sum + (Number(it.price) || 0), 0) || null,
      tags: newBundle.tags?.length ? newBundle.tags : null,
      date_range: newBundle.dateRange || null,
      created_at: newBundle.createdAt,
    };
    writeWithFallback('BundleContext', (row) => supabase.from('bundles').insert(row), bundleRow, NEW_BUNDLE_COLUMNS);
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
    if (patch.status !== undefined) dbPatch.status = toDbDealStatus(patch.status);
    if (patch.imageUrl !== undefined) { dbPatch.image = patch.imageUrl; dbPatch.cover_image = patch.imageUrl; }
    if (patch.videoUrl !== undefined) { dbPatch.image = ''; dbPatch.cover_image = patch.videoUrl; }
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.items !== undefined) {
      dbPatch.items = patch.items;
      dbPatch.total_value = patch.items.reduce((sum, it) => sum + (Number(it.price) || 0), 0) || null;
    }
    if (patch.location !== undefined) dbPatch.location = patch.location;
    if (patch.tags !== undefined) dbPatch.tags = patch.tags.length ? patch.tags : null;
    if (patch.dateRange !== undefined) dbPatch.date_range = patch.dateRange || null;
    if (patch.availableCount !== undefined) {
      const spots = Math.max(Math.floor(patch.availableCount) || 1, 1);
      dbPatch.available_count = spots;
      // Raising the limit re-opens a full bundle; lowering it can close one.
      const current = bundles.find((b) => b.id === id);
      if (current) {
        const next = (current.grabCount || 0) >= spots ? 'grabbed' : (current.status === 'grabbed' ? 'available' : (patch.status ?? current.status));
        dbPatch.status = toDbDealStatus(next);
      }
    }
    writeWithFallback('BundleContext', (row) => supabase.from('bundles').update(row).eq('id', id), dbPatch, NEW_BUNDLE_COLUMNS);
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
          .update({ grabs: newGrabCount, ...(newGrabCount >= capacity ? { status: 'paused' } : {}) })
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
            provider_avatar: bundle.creator?.avatar || '',
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
          price: Number(bundle.price || 0),
        },
        read: false,
        created_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) logger.warn('BundleContext', 'Notification insert failed', { error });
      });
      // The chat message (with the bundle card) is sent by the caller, which
      // then opens the conversation.
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
    () => ({ reload, bundles, myBundles, createBundle, updateBundle, grabBundle, deleteBundle }),
    [reload, bundles, myBundles, createBundle, updateBundle, grabBundle, deleteBundle]
  );

  return <BundleContext.Provider value={value}>{children}</BundleContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useBundles(): BundleContextValue {
  const ctx = useContext(BundleContext);
  if (!ctx) throw new Error('useBundles must be used within BundleProvider');
  return ctx;
}
