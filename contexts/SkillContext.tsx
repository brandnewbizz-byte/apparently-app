import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

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
  status: 'available' | 'grabbed' | 'fulfilled';
  grabCount: number;
  createdAt: string;
  availableCount: number;
  providerLink?: string;
  deliveryNotes?: string;
  resourcesNeeded?: string;
  expiresIn?: number; // seconds until deal expires
}

interface SkillContextValue {
  skills: UserSkill[];
  mySkills: UserSkill[];
  createSkill: (skill: Omit<UserSkill, 'id' | 'createdAt' | 'status' | 'grabCount'>) => { success: boolean; error?: string };
  grabSkill: (id: string) => void;
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

  useEffect(() => {
    let cancelled = false;
    const loadSkills = async () => {
      try {
        // Use skill_deals table (the actual DB table – not 'skills' which doesn't exist)
        const { data, error } = await supabase
          .from('skill_deals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          logger.error('SkillContext', 'Failed to fetch skill_deals from Supabase', { error });
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setSkills(JSON.parse(stored));
          return;
        }

        const liveSkills: UserSkill[] = (data || []).map((row: any) => ({
          id: row.id,
          title: row.service || '',
          description: row.description || '',
          icon: row.icon || '🛠️',
          price: Number(row.price) || 0,
          originalPrice: Number(row.price) || 0,
          imageUrl: row.featured_image || '',
          category: row.category || '',
          tags: row.tags || [],
          creatorId: row.user_id || '',
          creator: { name: 'Unknown', avatar: '', rating: 0, reviews: 0 },
          status: row.status || 'available',
          grabCount: row.grabs || 0,
          createdAt: row.created_at || new Date().toISOString(),
          availableCount: 1,
        }));

        setSkills(liveSkills);
        // Only show user's own skills on their profile
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const myId = authUser?.id || '';
        setMySkills(liveSkills.filter((s) => s.creatorId === myId));
        try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(liveSkills)); } catch {}
      } catch (e) {
        logger.error('SkillContext', 'Failed to load skills', { e });
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) setSkills(JSON.parse(stored));
        } catch {}
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };
    loadSkills();
    return () => { cancelled = true; };
  }, []);

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
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    supabase.from('skill_deals').insert({
      id: newSkill.id,
      user_id: newSkill.creatorId || '',
      service: newSkill.title,
      description: newSkill.description,
      featured_image: newSkill.imageUrl,
      category: newSkill.category,
      price: newSkill.price,
      status: newSkill.status,
      grabs: 0,
      created_at: newSkill.createdAt,
    }).then(({ error }) => {
      if (error) logger.error('SkillContext', 'Supabase insert into skill_deals failed', { error });
    });
    return { success: true };
  }, [isLoaded, saveSkills, mySkills.length]);

  const grabSkill = useCallback((id: string) => {
    setSkills((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, status: 'grabbed' as const, grabCount: s.grabCount + 1 } : s
      );
      if (isLoaded) saveSkills(updated);
      return updated;
    });
    // Sync to Supabase
    supabase.from('skill_deals').update({ status: 'grabbed' }).eq('id', id).then(({ error }) => {
      if (error) logger.error('SkillContext', 'Supabase grab update failed', { error });
    });
  }, [isLoaded, saveSkills]);

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
    () => ({ skills, mySkills, createSkill, grabSkill, deleteSkill }),
    [skills, mySkills, createSkill, grabSkill, deleteSkill]
  );

  return <SkillContext.Provider value={value}>{children}</SkillContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSkills(): SkillContextValue {
  const ctx = useContext(SkillContext);
  if (!ctx) throw new Error('useSkills must be used within SkillProvider');
  return ctx;
}
