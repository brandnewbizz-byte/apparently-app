import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

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
}

interface BundleContextValue {
  bundles: UserBundle[];
  myBundles: UserBundle[];
  createBundle: (bundle: Omit<UserBundle, 'id' | 'createdAt' | 'status' | 'grabCount'>) => { success: boolean; error?: string };
  grabBundle: (id: string) => void;
  deleteBundle: (id: string) => void;
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
    const mapRow = (row: any): UserBundle => ({
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      price: row.bundle_price ?? row.price ?? 0,
      items: row.items || row.services || [],
      imageUrl: row.image || row.cover_image || '',
      category: row.category || '',
      location: row.location || '',
      dateRange: row.expires_at || '',
      tags: row.tags || [],
      creatorId: row.user_id || row.creator_id || '',
      creator: { name: row.provider_name || 'Unknown', avatar: row.provider_avatar || '', rating: 0, reviews: 0 },
      status: row.status || 'available',
      grabCount: row.grabs ?? row.grab_count ?? 0,
      createdAt: row.created_at || new Date().toISOString(),
      availableCount: row.available_count || 1,
    });

    const loadBundles = async () => {
      try {
        let liveBundles: UserBundle[] = [];

        // 1. Try backend API (service key bypasses RLS)
        try {
          const res = await fetch(`${getApiUrl()}/api/home-feed`);
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
      id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    supabase.from('bundles').insert({
      id: newBundle.id,
      user_id: newBundle.creatorId,
      type: 'bundle',
      title: newBundle.title,
      description: newBundle.description || '',
      bundle_price: newBundle.price,
      items: newBundle.items,
      creator_id: newBundle.creatorId,
      image: newBundle.imageUrl,
      cover_image: newBundle.imageUrl,
      category: newBundle.category || 'lifestyle',
      location: newBundle.location || '',
      provider_name: newBundle.creator?.name || '',
      provider_avatar: newBundle.creator?.avatar || '',
      status: 'draft',
      grabs: 0,
      created_at: newBundle.createdAt,
    }).then(({ error }) => {
      if (error) logger.error('BundleContext', 'Supabase insert failed', { error });
    });
    return { success: true };
  }, [isLoaded, saveBundles, myBundles.length]);

  const grabBundle = useCallback((id: string) => {
    const bundle = bundles.find((b) => b.id === id);
    if (bundle && user?.id && bundle.creatorId === user.id) {
      logger.warn('BundleContext', 'Cannot grab own bundle');
      return;
    }
    setBundles((prev) => {
      const updated = prev.map((b) =>
        b.id === id ? { ...b, status: 'grabbed' as const, grabCount: b.grabCount + 1 } : b
      );
      if (isLoaded) saveBundles(updated);
      return updated;
    });
    // Sync to Supabase — use actual column names
    supabase.from('bundles').update({ grabs: (bundle?.grabCount || 0) + 1, status: 'grabbed' }).eq('id', id).then(({ error }) => {
      if (error) logger.error('BundleContext', 'Supabase grab update failed', { error });
    });
    // Create inbox notification for the bundle owner
    if (bundle?.creatorId && user?.id && bundle.creatorId !== user.id) {
      supabase.from('notifications').insert({
        recipient_id: bundle.creatorId,
        sender_id: user.id,
        type: 'bundle_grab',
        content: JSON.stringify({
          bundle_id: id,
          bundle_title: bundle.title,
          grabber_name: user.fullName || user.username || 'Someone',
          message: `grabbed your bundle "${bundle.title}"`,
        }),
        read: false,
        created_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) logger.warn('BundleContext', 'Notification insert failed', { error });
      });
    }
  }, [isLoaded, saveBundles, user?.id, user?.fullName, user?.username, bundles]);

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
    () => ({ bundles, myBundles, createBundle, grabBundle, deleteBundle }),
    [bundles, myBundles, createBundle, grabBundle, deleteBundle]
  );

  return <BundleContext.Provider value={value}>{children}</BundleContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useBundles(): BundleContextValue {
  const ctx = useContext(BundleContext);
  if (!ctx) throw new Error('useBundles must be used within BundleProvider');
  return ctx;
}
