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
    const loadSkills = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: UserSkill[] = JSON.parse(stored);
          const storedIds = new Set(parsed.map((s) => s.id));
          const merged = [
            ...parsed,
            ...SEED_SKILLS.filter((s) => !storedIds.has(s.id)),
          ];
          setSkills(merged);
          setMySkills(parsed.filter((s) => s.creatorId));
        }
      } catch (e) {
        logger.error('SkillContext', 'Failed to load skills', { e });
      } finally {
        setIsLoaded(true);
      }
    };
    loadSkills();
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
    // Sync to Supabase
    supabase.from('skills').insert({
      id: newSkill.id,
      title: newSkill.title,
      description: newSkill.description,
      icon: newSkill.icon,
      price: newSkill.price,
      original_price: newSkill.originalPrice,
      image_url: newSkill.imageUrl,
      category: newSkill.category,
      tags: newSkill.tags,
      creator_id: newSkill.creatorId || '',
      creator_name: newSkill.creator.name,
      creator_avatar: newSkill.creator.avatar,
      status: newSkill.status,
      grab_count: 0,
      created_at: newSkill.createdAt,
      available_count: newSkill.availableCount,
      provider_link: newSkill.providerLink,
      delivery_notes: newSkill.deliveryNotes,
      resources_needed: newSkill.resourcesNeeded,
      expires_in: newSkill.expiresIn,
    }).then(({ error }) => {
      if (error) logger.error('SkillContext', 'Supabase insert failed', { error });
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
    supabase.from('skills').update({ status: 'grabbed' }).eq('id', id).then(({ error }) => {
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
    supabase.from('skills').delete().eq('id', id).then(({ error }) => {
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
