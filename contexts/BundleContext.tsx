import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
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
  status: 'available' | 'grabbed' | 'fulfilled';
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

  // Load bundles from Supabase on mount (live backend)
  useEffect(() => {
    let cancelled = false;
    const loadBundles = async () => {
      try {
        const { data, error } = await supabase
          .from('bundles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          logger.error('BundleContext', 'Failed to fetch bundles from Supabase', { error });
          // Fall back to local cache if Supabase is down
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setBundles(JSON.parse(stored));
          return;
        }

        const liveBundles: UserBundle[] = (data || []).map((row: any) => ({
          id: row.id,
          title: row.title || '',
          description: row.description || '',
          price: row.price || 0,
          items: row.items || [],
          imageUrl: row.cover_image || '',
          category: row.category || '',
          location: row.location || '',
          dateRange: row.date_range || '',
          tags: row.tags || [],
          creatorId: row.creator_id || '',
          creator: { name: row.creator_name || 'Unknown', avatar: row.creator_avatar || '', rating: 0, reviews: 0 },
          status: row.status || 'available',
          grabCount: row.grab_count || 0,
          createdAt: row.created_at || new Date().toISOString(),
          availableCount: row.available_count || 1,
        }));

        setBundles(liveBundles);
        // Cache to AsyncStorage for offline fallback
        try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(liveBundles)); } catch {}
      } catch (e) {
        logger.error('BundleContext', 'Failed to load bundles', { e });
        // Fall back to local cache
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
    // Sync to Supabase
    supabase.from('bundles').insert({
      id: newBundle.id,
      title: newBundle.title,
      description: newBundle.description || '',
      price: newBundle.price,
      items: newBundle.items,
      creator_id: newBundle.creatorId,
      cover_image: newBundle.coverImage,
      status: newBundle.status,
      grab_count: 0,
      created_at: newBundle.createdAt,
    }).then(({ error }) => {
      if (error) logger.error('BundleContext', 'Supabase insert failed', { error });
    });
    return { success: true };
  }, [isLoaded, saveBundles, myBundles.length]);

  const grabBundle = useCallback((id: string) => {
    setBundles((prev) => {
      const updated = prev.map((b) =>
        b.id === id ? { ...b, status: 'grabbed' as const, grabCount: b.grabCount + 1 } : b
      );
      if (isLoaded) saveBundles(updated);
      return updated;
    });
    // Sync to Supabase
    supabase.rpc('increment_grab_count', { bundle_id: id }).then(({ error }) => {
      if (error) {
        supabase.from('bundles').update({ grab_count: supabase.sql`grab_count + 1` }).eq('id', id).then(({ error: e2 }) => {
          if (e2) logger.error('BundleContext', 'Supabase grab update failed', { error: e2 });
        });
      }
    });
  }, [isLoaded, saveBundles]);

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
