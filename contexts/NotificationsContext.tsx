import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Activity notifications (likes, comments, follows, grabs, calls, invites).
 * One shared, realtime-backed list so the header bell badge and the
 * Notifications screen always agree.
 */
export interface AppNotification {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string;
  actorAvatar: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

const PAGE_SIZE = 60;

function mapRow(n: any): AppNotification {
  return {
    id: n.id,
    type: n.type || '',
    actorId: n.actor_id || null,
    actorName: n.actor_name || 'Someone',
    actorAvatar: n.actor_avatar || '',
    title: n.title || '',
    body: n.body || '',
    data: n.data || {},
    read: !!n.read,
    createdAt: n.created_at,
  };
}

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) {
        logger.warn('Notifications', 'Load failed', { message: error.message });
        return;
      }
      setNotifications((data || []).map(mapRow));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    refresh();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = mapRow(payload.new);
          setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = mapRow(payload.new);
          setNotifications((prev) => prev.map((p) => (p.id === n.id ? n : p)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (id) setNotifications((prev) => prev.filter((p) => p.id !== id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids);
    if (error) logger.warn('Notifications', 'Mark all read failed', { message: error.message });
  }, [userId, notifications]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) logger.warn('Notifications', 'Mark read failed', { message: error.message });
  }, []);

  const remove = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) logger.warn('Notifications', 'Delete failed', { message: error.message });
  }, []);

  return { notifications, unreadCount, isLoading, refresh, markAllRead, markRead, remove };
});
