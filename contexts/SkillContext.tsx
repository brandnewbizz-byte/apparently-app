import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getApiUrl, fastFetch } from '@/lib/trpc';
import { logger } from '@/lib/logger';
import { sanitizeBundleDesc } from '@/lib/sanitize';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const mapRow = (row: any): UserSkill => ({
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

        if (cancelled) return;

        if (liveSkills.length === 0) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            const cached = JSON.parse(stored);
            setSkills(cached);
            setMySkills(cached);
          }
        } else {
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
      description: sanitizeBundleDesc(newSkill.description),
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
    const skill = skills.find((s) => s.id === id);
    if (skill && user?.id && skill.creatorId === user.id) {
      logger.warn('SkillContext', 'Cannot grab own skill');
      return;
    }
    setSkills((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, status: 'grabbed' as const, grabCount: s.grabCount + 1 } : s
      );
      if (isLoaded) saveSkills(updated);
      return updated;
    });
    // Sync to Supabase
    supabase.from('skill_deals').update({ status: 'grabbed', grabs: (skill?.grabCount || 0) + 1 }).eq('id', id).then(({ error }) => {
      if (error) logger.error('SkillContext', 'Supabase grab update failed', { error });
    });
    // Create inbox notification + auto-create DM for the skill owner
    if (skill?.creatorId && user?.id && skill.creatorId !== user.id) {
      const grabMessage = `👋 I'm interested in your skill "${skill.title}" — let's chat!`;
      const skillCard = {
        type: 'skill_card',
        id: skill.id,
        title: skill.title,
        description: skill.description || '',
        category: skill.category || '',
        price: skill.price || '',
        image_url: skill.imageUrl || '',
        creator_name: skill.creatorName || '',
      };
      // 1. Notification (DB columns: user_id, actor_id, actor_name, actor_avatar, data)
      const actorName = user.fullName || user.username || 'Someone';
      const actorAvatar = (user as any)?.avatarUrl || '';
      supabase.from('notifications').insert({
        user_id: skill.creatorId,
        actor_id: user.id,
        actor_name: actorName,
        actor_avatar: actorAvatar,
        type: 'skill_grab',
        title: `${actorName} grabbed your skill "${skill.title}"`,
        body: `grabbed your skill "${skill.title}"`,
        data: {
          skill_id: id,
          skill_title: skill.title,
        },
        read: false,
        created_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) logger.warn('SkillContext', 'Notification insert failed', { error });
      });
      // 2. Find or create a conversation between these two users
      (async () => {
        const [a, b] = [user.id, skill.creatorId].sort();
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
            logger.warn('SkillContext', 'Conversation create failed', { error: createErr });
            return;
          }
          conversationId = created.id;
        }
        // 3. Insert the grab message into the conversation with skill card metadata
        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: grabMessage,
          metadata: { skill_card: skillCard },
          created_at: new Date().toISOString(),
          read: false,
        });
        if (msgErr) logger.warn('SkillContext', 'Grab DM message insert failed', { error: msgErr });
      })();
    }
  }, [isLoaded, saveSkills, user?.id, user?.fullName, user?.username, skills]);

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
