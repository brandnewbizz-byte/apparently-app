import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { PlanData } from '@/contexts/PlanContext';

// ── Types ──
export type SyncEventType =
  | 'plan_updated' | 'timeline_changed' | 'vote_cast' | 'vote_decided'
  | 'task_added' | 'task_updated' | 'task_deleted'
  | 'idea_added' | 'idea_voted' | 'idea_converted'
  | 'budget_updated' | 'file_added' | 'section_changed';

export interface SyncEvent {
  type: SyncEventType;
  roomId: string;
  planId: string;
  userId: string;
  userName: string;
  timestamp: string;
  /** Partial plan data that changed */
  payload: Record<string, any>;
  /** Version number for conflict detection */
  version: number;
}

interface UseSupabaseRealtimeOptions {
  roomId: string;
  planId?: string;
  userId?: string;
  enabled?: boolean;
  onRemoteChange?: (event: SyncEvent) => void;
  onPresenceSync?: (presences: PresenceState[]) => void;
}

interface UseSupabaseRealtimeReturn {
  channel: RealtimeChannel | null;
  isConnected: boolean;
  broadcastEdit: (section: string, field: string, value: any) => void;
  broadcastTabChange: (tabId: string) => void;
  broadcastNavigation: (action: { type: string; payload?: any }) => void;
  syncPlan: (planData: PlanData) => void;
  presence: PresenceState[];
  editIndicators: { userId: string; userName: string; section: string; tab: string; startedAt: string }[];
}

export interface PresenceState {
  userId: string;
  userName: string;
  avatar: string | null;
  role: string;
  currentTab: string;
  editingSection: string | null;
  editingField: string | null;
  lastActive: string;
}

// ── Hook ──
export function useSupabaseRealtime(opts: UseSupabaseRealtimeOptions): UseSupabaseRealtimeReturn {
  const { roomId, planId, userId, enabled = true, onRemoteChange, onPresenceSync } = opts;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [editIndicators, setEditIndicators] = useState<
    { userId: string; userName: string; section: string; tab: string; startedAt: string }[]
  >([]);
  const presenceTracked = useRef(false);

  // ── Connect to realtime channel ──
  useEffect(() => {
    if (!enabled || !roomId) return;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { broadcast: { self: true }, presence: { key: userId || '' } },
    });

    // Listen for plan change events
    channel.on('broadcast', { event: 'plan_change' }, (payload: any) => {
      const event = payload.payload as SyncEvent;
      if (event.userId === userId) return; // skip own events
      onRemoteChange?.(event);
    });

    // Listen for edit indicators
    channel.on('broadcast', { event: 'edit_indicator' }, (payload: any) => {
      const { userId: editorId, userName, section, tab } = payload.payload;
      setEditIndicators(prev => {
        const filtered = prev.filter(e => e.userId !== editorId);
        if (!section) return filtered; // clear
        return [
          { userId: editorId, userName, section, tab: tab || '', startedAt: new Date().toISOString() },
          ...filtered,
        ];
      });
    });

    // Listen for clear edit indicator
    channel.on('broadcast', { event: 'clear_edit' }, (payload: any) => {
      const { userId: editorId } = payload.payload;
      setEditIndicators(prev => prev.filter(e => e.userId !== editorId));
    });

    // Presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const presences: PresenceState[] = [];
      for (const key of Object.keys(state)) {
        const entries = state[key] as any[];
        if (entries.length > 0) {
          presences.push(entries[0] as PresenceState);
        }
      }
      setPresence(presences);
      onPresenceSync?.(presences);
    });

    // Subscribe
    channel.subscribe(async (status) => {
      setIsConnected(status === 'SUBSCRIBED');

      if (status === 'SUBSCRIBED' && userId && !presenceTracked.current) {
        presenceTracked.current = true;
        await channel.track({
          userId,
          userName: '',
          avatar: null,
          role: '',
          currentTab: 'overview',
          editingSection: null,
          editingField: null,
          lastActive: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      presenceTracked.current = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, planId, userId, enabled]);

  // ── Broadcast plan edit ──
  const broadcastEdit = useCallback((section: string, field: string, value: any) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'plan_change',
      payload: {
        type: 'plan_updated',
        roomId,
        planId: planId || '',
        userId,
        userName: '',
        timestamp: new Date().toISOString(),
        payload: { section, field, value },
        version: Date.now(),
      },
    });

    // Also track as edit indicator
    channelRef.current?.send({
      type: 'broadcast',
      event: 'edit_indicator',
      payload: { userId, userName: '', section, tab: section },
    });

    // Auto-clear after 5s of no edits
    setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'clear_edit',
        payload: { userId },
      });
    }, 5000);
  }, [roomId, planId, userId]);

  // ── Broadcast tab change ──
  const broadcastTabChange = useCallback((tabId: string) => {
    channelRef.current?.track({
      userId,
      userName: '',
      avatar: null,
      role: '',
      currentTab: tabId,
      editingSection: null,
      editingField: null,
      lastActive: new Date().toISOString(),
    });
  }, [userId]);

  // ── Broadcast navigation (for presentation sync) ──
  const broadcastNavigation = useCallback((action: { type: string; payload?: any }) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'navigation',
      payload: { ...action, timestamp: new Date().toISOString(), userId },
    });
  }, [userId]);

  // ── Sync full plan (for presentation mode) ──
  const syncPlan = useCallback((planData: PlanData) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'plan_sync',
      payload: {
        planId: planData.id,
        data: planData,
        version: Date.now(),
        userId,
        timestamp: new Date().toISOString(),
      },
    });
  }, [userId]);

  return {
    channel: channelRef.current,
    isConnected,
    broadcastEdit,
    broadcastTabChange,
    broadcastNavigation,
    syncPlan,
    presence,
    editIndicators,
  };
}
