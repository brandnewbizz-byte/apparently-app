import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  addItem as dbAdd, listItems, mapItem, moveItem as dbMove, removeItem as dbRemove,
  updateItemMeta, toggleReaction, clamp01,
  type SpotItem, type SpotItemKind, type SpotPoint,
} from '@/lib/spot';

export interface SpotMember { id: string; name: string; avatar: string }
export interface LiveStroke { points: SpotPoint[]; color: string; width: number }
export interface Burst { key: string; emoji: string; x: number }

interface Me { id: string; name: string; avatar?: string | null }

/**
 * Everything live about one Spot room: saved items, who's here, items being
 * dragged and strokes being drawn by others right now, and reaction bursts.
 */
export function useSpotRoom(roomId: string | undefined, me: Me | null) {
  const [items, setItems] = useState<Record<string, SpotItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<SpotMember[]>([]);
  // Positions of items other people are dragging right now (not yet saved).
  const [remoteDrag, setRemoteDrag] = useState<Record<string, { x: number; y: number; z: number }>>({});
  // Strokes other people are drawing right now.
  const [liveStrokes, setLiveStrokes] = useState<Record<string, LiveStroke>>({});
  const [bursts, setBursts] = useState<Burst[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastMoveSent = useRef<Record<string, number>>({});
  const lastStrokeSent = useRef(0);
  const myId = me?.id || '';

  const upsert = useCallback((it: SpotItem) => setItems((prev) => ({ ...prev, [it.id]: it })), []);
  const drop = useCallback((id: string) => setItems((prev) => {
    if (!prev[id]) return prev;
    const next = { ...prev };
    delete next[id];
    return next;
  }), []);

  const pushBurst = useCallback((emoji: string, x: number) => {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setBursts((prev) => [...prev.slice(-24), { key, emoji, x }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.key !== key)), 2600);
  }, []);

  // Load + live subscription
  useEffect(() => {
    if (!roomId || !myId) return;
    let alive = true;
    setLoading(true);
    listItems(roomId)
      .then((list) => { if (alive) setItems(Object.fromEntries(list.map((i) => [i.id, i]))); })
      .catch((e) => { if (alive) setError(e?.message || 'Could not load this room'); })
      .finally(() => { if (alive) setLoading(false); });

    const channel = supabase.channel(`spot:${roomId}`, { config: { presence: { key: myId }, broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const list: SpotMember[] = [];
        for (const [id, metas] of Object.entries(state)) {
          const m = metas?.[0] || {};
          list.push({ id, name: m.name || 'Someone', avatar: m.avatar || '' });
        }
        setMembers(list);
      })
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        setRemoteDrag((prev) => ({ ...prev, [payload.id]: { x: payload.x, y: payload.y, z: payload.z } }));
      })
      .on('broadcast', { event: 'moved' }, ({ payload }) => {
        // Final position — apply it and stop showing the in-flight drag.
        setItems((prev) => (prev[payload.id] ? { ...prev, [payload.id]: { ...prev[payload.id], x: payload.x, y: payload.y, z: payload.z } } : prev));
        setRemoteDrag((prev) => { const n = { ...prev }; delete n[payload.id]; return n; });
      })
      .on('broadcast', { event: 'item' }, ({ payload }) => { if (payload?.item) upsert(payload.item as SpotItem); })
      .on('broadcast', { event: 'removed' }, ({ payload }) => drop(payload.id))
      .on('broadcast', { event: 'stroke' }, ({ payload }) => {
        setLiveStrokes((prev) => ({ ...prev, [payload.uid]: { points: payload.points, color: payload.color, width: payload.width } }));
      })
      .on('broadcast', { event: 'strokeEnd' }, ({ payload }) => {
        setLiveStrokes((prev) => { const n = { ...prev }; delete n[payload.uid]; return n; });
      })
      .on('broadcast', { event: 'burst' }, ({ payload }) => pushBurst(payload.emoji, payload.x))
      // Saved changes (covers anyone whose broadcast we missed).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'virtual_room_objects', filter: `room_id=eq.${roomId}` }, (p: any) => upsert(mapItem(p.new)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'virtual_room_objects', filter: `room_id=eq.${roomId}` }, (p: any) => {
        const it = mapItem(p.new);
        upsert(it);
        setRemoteDrag((prev) => { if (!prev[it.id]) return prev; const n = { ...prev }; delete n[it.id]; return n; });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'virtual_room_objects' }, (p: any) => { if (p.old?.id) drop(p.old.id); })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: me?.name || 'Someone', avatar: me?.avatar || '' });
        }
      });

    return () => {
      alive = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, myId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: 'broadcast', event, payload }).catch(() => {});
  }, []);

  const sorted = useMemo(() => Object.values(items).sort((a, b) => a.z - b.z), [items]);
  const topZ = useMemo(() => sorted.reduce((m, i) => Math.max(m, i.z), 0), [sorted]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const add = useCallback(async (input: {
    kind: SpotItemKind; x?: number; y?: number; emoji?: string; text?: string; color?: string;
    imageUrl?: string; points?: SpotPoint[]; width?: number;
  }) => {
    if (!roomId || !me) return null;
    // Doodles stay underneath everything else.
    const z = input.kind === 'doodle' ? -1 : topZ + 1;
    try {
      const it = await dbAdd(roomId, { id: me.id, name: me.name }, { ...input, z });
      upsert(it);
      send('item', { item: it });
      return it;
    } catch (e: any) {
      logger.warn('Spot', 'add failed', { error: e?.message });
      return null;
    }
  }, [roomId, me, topZ, upsert, send]);

  /** Live drag: update locally + stream to others (throttled). */
  const dragTo = useCallback((id: string, x: number, y: number, z: number) => {
    const nx = clamp01(x); const ny = clamp01(y);
    setItems((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], x: nx, y: ny, z } } : prev));
    const now = Date.now();
    if (now - (lastMoveSent.current[id] || 0) > 45) {
      lastMoveSent.current[id] = now;
      send('move', { id, x: nx, y: ny, z });
    }
  }, [send]);

  const dropAt = useCallback(async (id: string, x: number, y: number, z: number) => {
    const nx = clamp01(x); const ny = clamp01(y);
    send('moved', { id, x: nx, y: ny, z });
    try { await dbMove(id, nx, ny, z); } catch (e: any) { logger.warn('Spot', 'move save failed', { error: e?.message }); }
  }, [send]);

  const remove = useCallback(async (id: string) => {
    const before = items[id];
    drop(id);
    send('removed', { id });
    try { await dbRemove(id); return true; } catch {
      if (before) upsert(before);
      return false;
    }
  }, [items, drop, send, upsert]);

  const react = useCallback(async (id: string, emoji: string) => {
    const it = items[id];
    if (!it || !myId) return;
    const reactions = toggleReaction(it.reactions, emoji, myId);
    const next = { ...it, reactions };
    upsert(next);
    send('item', { item: next });
    if ((reactions[emoji] || []).includes(myId)) send('burst', { emoji, x: it.x });
    try { await updateItemMeta(it, { reactions }); } catch { upsert(it); }
  }, [items, myId, upsert, send]);

  const resize = useCallback(async (id: string, scale: number) => {
    const it = items[id];
    if (!it) return;
    const next = { ...it, scale: Math.min(3, Math.max(0.5, scale)) };
    upsert(next);
    send('item', { item: next });
    try { await updateItemMeta(it, { scale: next.scale }); } catch { upsert(it); }
  }, [items, upsert, send]);

  const editText = useCallback(async (id: string, text: string) => {
    const it = items[id];
    if (!it) return;
    const next = { ...it, text };
    upsert(next);
    send('item', { item: next });
    try { await updateItemMeta(it, { text }); } catch { upsert(it); }
  }, [items, upsert, send]);

  const bringToFront = useCallback((id: string) => {
    const it = items[id];
    if (!it) return;
    dropAt(id, it.x, it.y, topZ + 1);
    upsert({ ...it, z: topZ + 1 });
  }, [items, topZ, dropAt, upsert]);

  /** Reaction that floats up the screen for everyone. */
  const burst = useCallback((emoji: string, x = 0.5) => {
    pushBurst(emoji, x);
    send('burst', { emoji, x });
  }, [pushBurst, send]);

  /** Stream the stroke I'm drawing (throttled). */
  const strokeProgress = useCallback((points: SpotPoint[], color: string, width: number) => {
    const now = Date.now();
    if (now - lastStrokeSent.current < 70) return;
    lastStrokeSent.current = now;
    send('stroke', { uid: myId, points, color, width });
  }, [send, myId]);

  const strokeDone = useCallback(async (points: SpotPoint[], color: string, width: number) => {
    send('strokeEnd', { uid: myId });
    if (points.length < 2) return null;
    return add({ kind: 'doodle', points, color, width });
  }, [send, myId, add]);

  return {
    items: sorted, loading, error, members, remoteDrag, liveStrokes, bursts, topZ,
    add, dragTo, dropAt, remove, react, resize, editText, bringToFront, burst, strokeProgress, strokeDone,
  };
}
