import React, { useRef, createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromDbDealStatus, toDbDealStatus } from '@/lib/dealStatus';
import { supabase } from '@/lib/supabase';
import { getApiUrl, fastFetch } from '@/lib/trpc';
import { logger } from '@/lib/logger';
import { sanitizeBundleDesc } from '@/lib/sanitize';
import { useAuth } from '@/contexts/AuthContext';
import { uuid } from '@/lib/uuid';
import { writeWithFallback } from '@/lib/dbWrite';

// ── Types ──────────────────────────────────────────────────────────────────

export const MAX_SKILLS = 10;

export interface UserSkill {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  price: number;
  originalPrice: number;
  imageUrl: string;
  category: string;
  tags: string[];
  creatorId?: string;
  creator: { name: string; avatar: string; rating: number; reviews: number };
  status: 'available' | 'grabbed' | 'fulfilled' | 'active' | 'draft' | 'published';
  grabCount: number;
  createdAt: string;
  availableCount: number;
  providerLink?: string;
  deliveryNotes?: string;
  resourcesNeeded?: string;
  expiresIn?: number; // seconds until deal expires (only when the deal has an end)
  /** When the deal ends (ISO). null/undefined = no end. */
  expiresAt?: string | null;
}

/** Columns added after launch; writes retry without them on older databases. */
const NEW_SKILL_COLUMNS = ['icon', 'tags', 'original_price', 'expires_at', 'available_count'];
const secondsUntil = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000)) : undefined);

interface SkillContextValue {
  /** Re-fetch from the server. */
  reload: () => Promise<void>;
  skills: UserSkill[];
  mySkills: UserSkill[];
  createSkill: (skill: Omit<UserSkill, 'id' | 'createdAt' | 'status' | 'grabCount'>) => { success: boolean; error?: string };
  updateSkill: (id: string, patch: Partial<UserSkill>) => void;
  grabSkill: (id: string) => Promise<{ ok: boolean; reason?: 'own' | 'already_grabbed' | 'not_signed_in' | 'not_found' | 'full' | 'error' }>;
  deleteSkill: (id: string) => void;
}

const SkillContext = createContext<SkillContextValue | undefined>(undefined);

const STORAGE_KEY = 'apparently_skills_v1';

// ── Seed Data ──────────────────────────────────────────────────────────────

// No seed data — all skills now come from live Supabase.
const SEED_SKILLS: UserSkill[] = [];

// ── Provider ───────────────────────────────────────────────────────────────

export function SkillProvider({ children }: { children: React.ReactNode }) {
  const [skills, setSkills] = useState<UserSkill[]>(SEED_SKILLS);
  const [mySkills, setMySkills] = useState<UserSkill[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  const reloadRef = useRef(0);
  const reload = useCallback(async () => {
    const run = ++reloadRef.current;
    const cancelledNow = () => run !== reloadRef.current;
    const mapRow = (row: any): UserSkill => ({
      id: row.id,
      title: row.service || '',
      description: row.description || '',
      icon: row.icon || '🛠️',
      price: Number(row.price) || 0,
      // Regular price before the deal; equal to price when there's no discount.
      originalPrice: Number(row.original_price) > Number(row.price) ? Number(row.original_price) : Number(row.price) || 0,
      expiresAt: row.expires_at || null,
      expiresIn: secondsUntil(row.expires_at),
      imageUrl: row.featured_image || '',
      category: row.category || '',
      tags: row.tags || [],
      creatorId: row.user_id || '',
      creator: { name: 'Unknown', avatar: '', rating: 0, reviews: 0 },
      status: fromDbDealStatus(row.status, Number(row.grabs) || 0, Math.max(Number(row.available_count) || 20, 1)),
      grabCount: row.grabs || 0,
      createdAt: row.created_at || new Date().toISOString(),
      // How many people can grab it (set by the creator; default 20).
      availableCount: Math.max(Number(row.available_count) || 20, 1),
    });

    const loadSkills = async () => {
      try {
        let liveSkills: UserSkill[] = [];

        // 1. Backend API (service key bypasses RLS)
        try {
          const res = await fastFetch(`${getApiUrl()}/api/home-feed`);
          if (res.ok) {
            const json = await res.json();
            if (json.skillDeals?.length) liveSkills = json.skillDeals.map(mapRow);
          }
        } catch { /* fall through */ }

        // 2. Fallback: direct Supabase
        if (liveSkills.length === 0) {
          const { data, error } = await supabase
            .from('skill_deals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          if (!error && data?.length) liveSkills = data.map(mapRow);
        }

        if (cancelledNow()) return;

        if (liveSkills.length === 0) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            const cached = JSON.parse(stored);
            setSkills(cached);
            const { data: { user: cu } } = await supabase.auth.getUser();
            setMySkills(cached.filter((x: any) => x.creatorId === (cu?.id || '')));
          }
        } else {
          // Rows don't carry the creator's name/avatar — look them up.
          try {
            const ids = [...new Set(liveSkills.map((x) => x.creatorId).filter(Boolean))];
            if (ids.length) {
              const { data: profs } = await supabase.from('profiles').select('id, full_name, username, avatar').in('id', ids);
              const byId = new Map((profs || []).map((p: any) => [p.id, p]));
              for (const x of liveSkills) {
                const pr: any = byId.get(x.creatorId || '');
                if (pr) x.creator = { ...x.creator, name: x.creator?.name && x.creator.name !== 'Unknown' ? x.creator.name : (pr.full_name || pr.username || 'Someone'), avatar: x.creator?.avatar || pr.avatar || '' };
              }
            }
          } catch { /* names are optional */ }
          setSkills(liveSkills);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          setMySkills(liveSkills.filter((s) => s.creatorId === (authUser?.id || '')));
          try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(liveSkills)); } catch {}
        }
      } catch (e) {
        logger.error('SkillContext', 'Failed to load skills', { e });
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setSkills(JSON.parse(stored));
        } catch {}
      } finally {
        if (!cancelledNow()) setIsLoaded(true);
      }
    };
    await loadSkills();
  }, []);

  // Load on start and again when the signed-in account changes.
  useEffect(() => { reload(); }, [reload, user?.id]);

  const saveSkills = useCallback(async (updatedSkills: UserSkill[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSkills));
    } catch (e) {
      logger.error('SkillContext', 'Failed to save skills', { e });
    }
  }, []);

  const createSkill = useCallback((skill: Omit<UserSkill, 'id' | 'createdAt' | 'status' | 'grabCount'>) => {
    if (mySkills.length >= MAX_SKILLS) {
      return { success: false, error: `You can only have up to ${MAX_SKILLS} skills posted at once.` };
    }
    const newSkill: UserSkill = {
      ...skill,
      id: uuid(),
      createdAt: new Date().toISOString(),
      status: 'available',
      grabCount: 0,
    };
    setSkills((prev) => {
      const updated = [newSkill, ...prev];
      if (isLoaded) saveSkills(updated);
      return updated;
    });
    setMySkills((prev) => [newSkill, ...prev]);
    // Sync to Supabase (skill_deals table – the real DB table)
    const skillRow: Record<string, unknown> = {
      id: newSkill.id,
      user_id: newSkill.creatorId || '',
      creator_id: newSkill.creatorId || null,
      service: newSkill.title,
      description: sanitizeBundleDesc(newSkill.description),
      featured_image: newSkill.imageUrl,
      category: newSkill.category,
      price: newSkill.price,
      // skill_deals.status only accepts active | paused | deleted
      status: toDbDealStatus(newSkill.status),
      grabs: 0,
      available_count: Math.max(Math.floor(newSkill.availableCount || 20), 1),
      icon: newSkill.icon || null,
      tags: newSkill.tags?.length ? newSkill.tags : null,
      original_price: newSkill.originalPrice > newSkill.price ? newSkill.originalPrice : null,
      expires_at: newSkill.expiresAt || null,
      created_at: newSkill.createdAt,
    };
    writeWithFallback('SkillContext', (row) => supabase.from('skill_deals').insert(row), skillRow, NEW_SKILL_COLUMNS);
    return { success: true };
  }, [isLoaded, saveSkills, mySkills.length]);

  const updateSkill = useCallback((id: string, patch: Partial<UserSkill>) => {
    if (patch.expiresAt !== undefined) patch = { ...patch, expiresIn: secondsUntil(patch.expiresAt) };
    setSkills((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      if (isLoaded) saveSkills(updated);
      return updated;
    });
    setMySkills((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    // Sync to Supabase (skill_deals table)
    const dbPatch: Record<string, any> = {};
    if (patch.title !== undefined) dbPatch.service = patch.title;
    if (patch.description !== undefined) dbPatch.description = sanitizeBundleDesc(patch.description);
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.status !== undefined) dbPatch.status = toDbDealStatus(patch.status);
    if (patch.availableCount !== undefined) dbPatch.available_count = Math.max(Math.floor(patch.availableCount) || 1, 1);
    if (patch.imageUrl !== undefined) dbPatch.featured_image = patch.imageUrl;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.icon !== undefined) dbPatch.icon = patch.icon;
    if (patch.tags !== undefined) dbPatch.tags = patch.tags.length ? patch.tags : null;
    if (patch.originalPrice !== undefined) dbPatch.original_price = patch.originalPrice > (patch.price ?? 0) ? patch.originalPrice : null;
    if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt || null;
    writeWithFallback('SkillContext', (row) => supabase.from('skill_deals').update(row).eq('id', id), dbPatch, NEW_SKILL_COLUMNS);
  }, [isLoaded, saveSkills]);

  /** Book a skill. Resolves once the booking is recorded. */
  const grabSkill = useCallback(async (id: string): Promise<{ ok: boolean; reason?: 'own' | 'already_grabbed' | 'not_signed_in' | 'not_found' | 'full' | 'error' }> => {
    const skill = skills.find((s) => s.id === id);
    if (!skill) return { ok: false, reason: 'not_found' };
    if (!user?.id || user.id.startsWith('u-')) return { ok: false, reason: 'not_signed_in' };
    if (!skill.creatorId || skill.creatorId.startsWith('u-')) return { ok: false, reason: 'not_found' };
    if (skill.creatorId === user.id) return { ok: false, reason: 'own' };

    // 0. Claim a spot on the server (respects the creator's grab limit).
    //    Databases without grab_skill_deal fall back to the old counter path.
    const { data: claim, error: claimErr } = await supabase.rpc('grab_skill_deal', { p_skill: id });
    const claimed = !claimErr && claim && (claim as any).ok;
    if (!claimErr && claim && !(claim as any).ok) {
      const reason = (claim as any).reason;
      if (reason === 'full') {
        setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'grabbed' } : s)));
        return { ok: false, reason: 'full' };
      }
      if (reason === 'already_grabbed' || reason === 'own' || reason === 'not_found') return { ok: false, reason };
    }
    if (!claimed && skill.grabCount >= (skill.availableCount || 20)) return { ok: false, reason: 'full' };

    // 1. Record the booking (one per person per skill).
    const now = new Date().toISOString();
    const { error: grabErr } = await supabase.from('user_grabs').insert({
      user_id: user.id,
      provider_id: skill.creatorId,
      item_id: skill.id,
      item_type: 'deal', // user_grabs.item_type: bundle | deal | job | listing
      title: skill.title,
      price: Number(skill.price || 0),
      status: 'pending',
      provider_name: skill.creator?.name || '',
      provider_avatar: skill.creator?.avatar || '',
      created_at: now,
      updated_at: now,
      booked_at: now,
    });
    if (grabErr) {
      if (grabErr.code === '23505') return { ok: false, reason: 'already_grabbed' };
      logger.warn('SkillContext', 'user_grabs insert failed', { error: grabErr });
      return { ok: false, reason: 'error' };
    }

    // Skills can be booked by many people: only bump the shared counter
    // (marking the shared row 'grabbed' would hide it from everyone).
    setSkills((prev) => {
      const updated = prev.map((s) => (s.id === id
        ? { ...s, grabCount: s.grabCount + 1, status: s.grabCount + 1 >= (s.availableCount || 20) ? ('grabbed' as const) : s.status }
        : s));
      if (isLoaded) saveSkills(updated);
      return updated;
    });
    if (!claimed) {
      supabase.rpc('increment_deal_stat', { p_kind: 'skill', p_id: id, p_column: 'grabs' }).then(({ error }) => {
        if (error) logger.warn('SkillContext', 'Grab counter update failed', { error });
      });
    }

    // 2. Tell the owner — this is what shows in their Manage → Orders.
    const actorName = user.fullName || user.username || 'Someone';
    supabase.from('notifications').insert({
      user_id: skill.creatorId,
      actor_id: user.id,
      actor_name: actorName,
      actor_avatar: user.avatar || '',
      type: 'skill_grab',
      title: `${actorName} grabbed your skill "${skill.title}"`,
      body: `grabbed your skill "${skill.title}"`,
      data: {
        skill_id: id,
        skill_title: skill.title,
        skill_image: skill.imageUrl || '',
        skill_price: Number(skill.price || 0),
        price: Number(skill.price || 0),
      },
      read: false,
      created_at: now,
    }).then(({ error }) => {
      if (error) logger.warn('SkillContext', 'Notification insert failed', { error });
    });
    // The chat message (with the skill card) is sent by the caller.
    return { ok: true };
  }, [isLoaded, saveSkills, user, skills]);

  const deleteSkill = useCallback((id: string) => {
    setSkills((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (isLoaded) saveSkills(updated);
      return updated;
    });
    setMySkills((prev) => prev.filter((s) => s.id !== id));
    // Sync to Supabase
    supabase.from('skill_deals').delete().eq('id', id).then(({ error }) => {
      if (error) logger.error('SkillContext', 'Supabase delete failed', { error });
    });
  }, [isLoaded, saveSkills]);

  const value = useMemo(
    () => ({ reload, skills, mySkills, createSkill, updateSkill, grabSkill, deleteSkill }),
    [reload, skills, mySkills, createSkill, updateSkill, grabSkill, deleteSkill]
  );

  return <SkillContext.Provider value={value}>{children}</SkillContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSkills(): SkillContextValue {
  const ctx = useContext(SkillContext);
  if (!ctx) throw new Error('useSkills must be used within SkillProvider');
  return ctx;
}
