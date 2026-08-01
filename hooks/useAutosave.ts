import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlanData } from '@/contexts/PlanContext';

// ── Types ──
export interface PlanVersion {
  id: string;
  planId: string;
  roomId: string;
  version: number;
  data: PlanData;
  editedBy: string;
  editedByName: string;
  createdAt: string;
  summary: string;
}

interface UseAutosaveOptions {
  roomId: string;
  planId?: string;
  userId?: string;
  userName?: string;
  enabled?: boolean;
  debounceMs?: number;
  onConflict?: (local: PlanData, remote: PlanData) => PlanData | null;
}

interface UseAutosaveReturn {
  save: (planData: PlanData, summary?: string) => void;
  saveNow: (planData: PlanData, summary?: string) => Promise<void>;
  loadVersions: () => Promise<PlanVersion[]>;
  loadVersion: (versionId: string) => Promise<PlanData | null>;
  rollback: (versionId: string) => Promise<PlanData | null>;
  lastSavedVersion: number;
  isSaving: boolean;
  hasConflict: boolean;
}

// ── Hook ──
export function useAutosave(opts: UseAutosaveOptions): UseAutosaveReturn {
  const {
    roomId, planId, userId, userName = '',
    enabled = true, debounceMs = 2000, onConflict,
  } = opts;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ planData: PlanData; summary?: string } | null>(null);
  const versionRef = useRef(0);
  const savingRef = useRef(false);

  // ── Actual save to Supabase ──
  const persistPlan = useCallback(async (planData: PlanData, summary?: string) => {
    if (!planId || !roomId || !userId) return;

    const newVersion = versionRef.current + 1;
    versionRef.current = newVersion;

    const versionId = `v_${planId}_${newVersion}`;

    try {
      // Check remote version for conflicts
      const { data: latest } = await supabase
        .from('plan_sync')
        .select('version, data')
        .eq('plan_id', planId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (latest && onConflict) {
        const remoteData = typeof latest.data === 'string'
          ? JSON.parse(latest.data)
          : latest.data;

        if (latest.version > versionRef.current - 1 && onConflict) {
          const resolved = onConflict(planData, remoteData as PlanData);
          if (resolved) {
            // Use resolved version
            planData = resolved;
          }
        }
      }

      // Insert new version
      const dataStr = JSON.stringify(planData);
      await supabase.from('plan_sync').insert({
        id: versionId,
        room_id: roomId,
        plan_id: planId,
        section: 'full',
        field: 'data',
        value: dataStr,
        version: newVersion,
        edited_by: userId,
        edited_by_name: userName,
        created_at: new Date().toISOString(),
      });

      // Also update the main plans table
      await supabase.from('plans').upsert({
        id: planId,
        room_id: roomId,
        title: planData.title,
        goal: planData.goal,
        description: planData.description,
        project_type: planData.projectType,
        start_date: planData.startDate,
        target_date: planData.targetDate,
        stage: planData.stage,
        progress: planData.progress,
        owner_id: planData.ownerId,
        data: dataStr,
        updated_at: new Date().toISOString(),
      });

      // Log to room history
      if (summary) {
        await supabase.from('room_history').insert({
          room_id: roomId,
          user_id: userId,
          user_name: userName,
          action: 'plan_edited',
          detail: summary,
          metadata: JSON.stringify({ version: newVersion, planId }),
        });
      }
    } catch (err) {
      console.warn('[autosave] Save failed:', err);
    }
  }, [planId, roomId, userId, userName, onConflict]);

  // ── Debounced save ──
  const save = useCallback((planData: PlanData, summary?: string) => {
    if (!enabled) return;
    pendingRef.current = { planData, summary };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pendingRef.current) {
        persistPlan(pendingRef.current.planData, pendingRef.current.summary);
        pendingRef.current = null;
      }
    }, debounceMs);
  }, [enabled, debounceMs, persistPlan]);

  // ── Immediate save ──
  const saveNow = useCallback(async (planData: PlanData, summary?: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    savingRef.current = true;
    await persistPlan(planData, summary);
    savingRef.current = false;
  }, [persistPlan]);

  // ── Load version history ──
  const loadVersions = useCallback(async (): Promise<PlanVersion[]> => {
    if (!planId) return [];

    const { data } = await supabase
      .from('plan_sync')
      .select('*')
      .eq('plan_id', planId)
      .order('version', { ascending: false })
      .limit(50);

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      planId: row.plan_id,
      roomId: row.room_id,
      version: row.version,
      data: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      editedBy: row.edited_by,
      editedByName: row.edited_by_name,
      createdAt: row.created_at,
      summary: '',
    }));
  }, [planId]);

  // ── Load specific version ──
  const loadVersion = useCallback(async (versionId: string): Promise<PlanData | null> => {
    const { data } = await supabase
      .from('plan_sync')
      .select('value')
      .eq('id', versionId)
      .single();

    if (!data?.value) return null;
    return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  }, []);

  // ── Rollback to a version ──
  const rollback = useCallback(async (versionId: string): Promise<PlanData | null> => {
    const planData = await loadVersion(versionId);
    if (planData && planId) {
      await persistPlan(planData, `Rolled back to version from ${versionId}`);
      return planData;
    }
    return null;
  }, [loadVersion, planId, persistPlan]);

  // ── Set initial version from DB ──
  useEffect(() => {
    if (!planId) return;
    supabase
      .from('plan_sync')
      .select('version')
      .eq('plan_id', planId)
      .order('version', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.version) {
          versionRef.current = data.version;
        }
      })
      .then(() => {}, () => {});
  }, [planId]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      // Flush any pending save on unmount
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current) {
        persistPlan(pendingRef.current.planData, pendingRef.current.summary).catch(() => {});
      }
    };
  }, []);

  return {
    save,
    saveNow,
    loadVersions,
    loadVersion,
    rollback,
    lastSavedVersion: versionRef.current,
    isSaving: savingRef.current,
    hasConflict: false,
  };
}
