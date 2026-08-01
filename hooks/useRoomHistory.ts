import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ──
export type HistoryAction =
  | 'user_joined' | 'user_left' | 'room_created'
  | 'resource_uploaded' | 'plan_edited'
  | 'task_added' | 'task_completed' | 'task_updated' | 'task_deleted'
  | 'budget_updated' | 'timeline_changed'
  | 'presentation_started' | 'presentation_ended'
  | 'vote_created' | 'vote_cast' | 'vote_decided'
  | 'control_requested' | 'control_given' | 'control_taken'
  | 'user_muted' | 'user_unmuted' | 'mute_all'
  | 'user_removed' | 'role_changed'
  | 'discussion_open' | 'discussion_closed'
  | 'section_added' | 'section_updated'
  | 'idea_added' | 'idea_voted' | 'idea_converted'
  | 'file_added' | 'file_deleted';

export interface HistoryEntry {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  action: HistoryAction;
  detail: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface HistoryFilters {
  actions?: HistoryAction[];
  userId?: string;
  since?: string;
  until?: string;
}

interface UseRoomHistoryOptions {
  roomId: string;
  enabled?: boolean;
  limit?: number;
}

interface UseRoomHistoryReturn {
  entries: HistoryEntry[];
  isLoading: boolean;
  logEvent: (action: HistoryAction, detail: string, metadata?: Record<string, any>) => Promise<void>;
  refresh: () => Promise<void>;
  filter: (filters: HistoryFilters) => HistoryEntry[];
}

// ── Hook ──
export function useRoomHistory(opts: UseRoomHistoryOptions): UseRoomHistoryReturn {
  const { roomId, enabled = true, limit = 100 } = opts;
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch history ──
  const refresh = useCallback(async () => {
    if (!roomId || !enabled) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('room_history')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setEntries(data.map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          userId: row.user_id,
          userName: row.user_name,
          action: row.action as HistoryAction,
          detail: row.detail,
          metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
          timestamp: row.created_at,
        })));
      }
    } catch {}
    setIsLoading(false);
  }, [roomId, enabled, limit]);

  // ── Log a history event ──
  const logEvent = useCallback(async (
    action: HistoryAction,
    detail: string,
    metadata?: Record<string, any>,
  ) => {
    if (!roomId || !enabled) return;

    const entry: HistoryEntry = {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomId,
      userId: '',
      userName: '',
      action,
      detail,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Optimistic local update
    setEntries(prev => [entry, ...prev.slice(0, limit - 1)]);

    // Persist to Supabase
    try {
      await supabase.from('room_history').insert({
        room_id: roomId,
        user_id: '',
        user_name: '',
        action,
        detail,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } catch {}
  }, [roomId, enabled, limit]);

  // ── Filter ──
  const filter = useCallback((filters: HistoryFilters): HistoryEntry[] => {
    return entries.filter(e => {
      if (filters.actions && !filters.actions.includes(e.action)) return false;
      if (filters.userId && e.userId !== filters.userId) return false;
      if (filters.since && e.timestamp < filters.since) return false;
      if (filters.until && e.timestamp > filters.until) return false;
      return true;
    });
  }, [entries]);

  // ── Initial load ──
  useEffect(() => {
    refresh();
  }, [roomId]);

  // ── Supabase realtime subscription for live history ──
  useEffect(() => {
    if (!roomId || !enabled) return;

    const channel = supabase
      .channel(`room-history-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_history',
        filter: `room_id=eq.${roomId}`,
      }, (payload: any) => {
        const row = payload.new;
        setEntries(prev => {
          const newEntry: HistoryEntry = {
            id: row.id,
            roomId: row.room_id,
            userId: row.user_id,
            userName: row.user_name,
            action: row.action as HistoryAction,
            detail: row.detail,
            metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
            timestamp: row.created_at,
          };
          // Avoid duplicates
          if (prev.some(e => e.id === newEntry.id)) return prev;
          return [newEntry, ...prev.slice(0, limit - 1)];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, enabled, limit]);

  return { entries, isLoading, logEvent, refresh, filter };
}
