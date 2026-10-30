import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export type OrderKind = 'bundle' | 'skill' | 'service';
export type OrderStatus = 'requested' | 'accepted' | 'fulfilled' | 'declined';

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}

export interface GrabOrder {
  id: string; // grab notification id (durable)
  kind: OrderKind;
  itemId: string; // bundle / skill_deals id
  itemTitle: string;
  price?: number;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  status: OrderStatus;
  createdAt: string; // when grabbed
  statusHistory: OrderStatusEvent[]; // ordered timeline of status transitions
}

interface OrdersContextValue {
  orders: GrabOrder[]; // incoming grabs against MY items
  pendingCount: number; // unresolved ('requested') count → badge
  loading: boolean;
  refresh: () => void;
  acceptOrder: (order: GrabOrder) => Promise<void>;
  fulfillOrder: (order: GrabOrder) => Promise<void>;
  declineOrder: (order: GrabOrder) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

const ORDERS_KEY = 'Apparently_GrabOrdersResolved_v1';

const ORDER_TYPES: Record<string, OrderKind> = { bundle_grab: 'bundle', skill_grab: 'skill', service_grab: 'service', service_response: 'service' };

const GRAB_TO_ORDER: Record<string, OrderStatus> = {
  pending: 'requested', requested: 'requested', accepted: 'accepted', active: 'accepted', confirmed: 'accepted', in_progress: 'accepted',
  fulfilled: 'fulfilled', completed: 'fulfilled', declined: 'declined', cancelled: 'declined',
};
// user_grabs.status allows pending | confirmed | in_progress | completed | cancelled
const ORDER_TO_GRAB: Record<OrderStatus, string> = {
  requested: 'pending', accepted: 'confirmed', fulfilled: 'completed', declined: 'cancelled',
};

// Grab notification `data` carries the item id/title keyed differently per type.
const itemFields: Record<OrderKind, { id: string; title: string }> = {
  bundle: { id: 'bundle_id', title: 'bundle_title' },
  skill: { id: 'skill_id', title: 'skill_title' },
  service: { id: 'request_id', title: 'request_title' },
};

// ── Provider ───────────────────────────────────────────────────────────────

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedMap, setResolvedMap] = useState<Record<string, OrderStatus>>({});

  // Load locally-resolved states (survives offline / reload while DB round-trips settle)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ORDERS_KEY);
        if (raw && !cancelled) setResolvedMap(JSON.parse(raw));
      } catch (e) {
        logger.warn('OrdersContext', 'Failed to load resolved map', { e });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistResolved = useCallback((next: Record<string, OrderStatus>) => {
    setResolvedMap(next);
    try { AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }, []);

  // grab rows (user_grabs) against MY items: status is stored there so it is
  // shared across devices and visible to the buyer.
  const [grabStatus, setGrabStatus] = useState<Record<string, OrderStatus>>({});

  const buildOrder = useCallback((n: any): GrabOrder | null => {
    const kind = ORDER_TYPES[n.type];
    if (!kind) return null;
    const extra = n.data || {};
    const fields = itemFields[kind];
    const current: OrderStatus = grabStatus[`${n.actor_id}:${extra[fields.id] || ''}`] || resolvedMap[n.id] || 'requested';
    const at: string = n.created_at || new Date().toISOString();
    return {
      id: n.id,
      kind,
      itemId: extra[fields.id] || '',
      itemTitle: extra[fields.title] || (kind === 'bundle' ? 'Bundle' : kind === 'skill' ? 'Skill' : 'Request'),
      price: extra.price ? Number(extra.price) : undefined,
      buyerId: n.actor_id || '',
      buyerName: n.actor_name || 'Someone',
      buyerAvatar: n.actor_avatar || '',
      status: current,
      createdAt: at,
      statusHistory: current === 'requested' ? [{ status: 'requested', at }] : [{ status: 'requested', at }, { status: current, at }],
    };
  }, [resolvedMap, grabStatus]);

  const loadOrders = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data: grabs } = await supabase
        .from('user_grabs')
        .select('user_id, item_id, status')
        .eq('provider_id', user.id)
        .limit(500);
      const map: Record<string, OrderStatus> = {};
      for (const g of (grabs || []) as any[]) {
        const st = GRAB_TO_ORDER[g.status];
        if (st) map[`${g.user_id}:${g.item_id}`] = st;
      }
      setGrabStatus(map);
      // Grab notifications addressed to me = someone grabbing my item.
      const { data, error } = await supabase
        .from('notifications')
        .select('id, actor_id, actor_name, actor_avatar, type, data, created_at')
        .eq('user_id', user.id)
        .in('type', ['bundle_grab', 'skill_grab', 'service_grab', 'service_response'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('OrdersContext', 'load grab notifications failed', { error });
        return;
      }
      setRawRows(data || []);
    } catch (e) {
      logger.error('OrdersContext', 'loadOrders exception', { e });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Orders = grab notifications + their current status (derived, so loading
  // never depends on the status maps it fills in).
  const orders = useMemo<GrabOrder[]>(
    () => rawRows.map(buildOrder).filter((o): o is GrabOrder => o !== null),
    [rawRows, buildOrder],
  );

  useEffect(() => {
    if (user?.id) loadOrders();
    else setLoading(false);
  }, [user?.id, loadOrders]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`orders-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p: any) => {
        if (ORDER_TYPES[p.new?.type]) loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadOrders]);

  const markOrder = useCallback(
    (orderId: string, status: OrderStatus) => {
      persistResolved({ ...resolvedMap, [orderId]: status });
    },
    [resolvedMap, persistResolved]
  );

  // Owner-side name/avatar for buyer-facing notification sender info.
  const meName = useMemo(() => {
    const u: any = user;
    return u?.fullName || u?.username || 'Provider';
  }, [user]);
  const meAvatar = useMemo(() => ((user as any)?.avatarUrl as string) || '', [user]);

  // Bundle/skill grab resolves against the item row (bundles / skill_deals).
  // A service grab resolves against the job_request the responder created
  // (identified by request_id + responder), NOT the public service_requests row
  // (we never hide a public request — many helpers may be considered).
  // Save the order's status on the buyer's grab row. Never touch the listing
  // itself — marking a bundle 'fulfilled' used to hide it from everyone.
  const setItemStatus = useCallback(async (order: GrabOrder, status: OrderStatus) => {
    if (!order.itemId || !user?.id) return;
    setGrabStatus((prev) => ({ ...prev, [`${order.buyerId}:${order.itemId}`]: status }));
    try {
      const { error } = await supabase
        .from('user_grabs')
        .update({ status: ORDER_TO_GRAB[status], updated_at: new Date().toISOString() })
        .eq('item_id', order.itemId)
        .eq('user_id', order.buyerId)
        .eq('provider_id', user.id);
      if (error) logger.warn('OrdersContext', 'setItemStatus failed', { error: error.message });
    } catch (e) {
      logger.warn('OrdersContext', 'setItemStatus failed', { e });
    }
  }, [user?.id]);

  const notifyBuyer = useCallback(
    async (order: GrabOrder, subject: string, body: string, emoji: string) => {
      if (!order.buyerId) return;
      try {
        // notifications.type only allows a fixed list (no bundle_order etc.).
        const type = subject === 'accepted' ? 'grab_accepted' : subject === 'declined' ? 'grab_declined' : 'general';
        await supabase.from('notifications').insert({
          user_id: order.buyerId,
          actor_id: user?.id,
          actor_name: meName,
          actor_avatar: meAvatar,
          type,
          title: body,
          body,
          data: { item_id: order.itemId, item_title: order.itemTitle, subject, emoji, order_kind: order.kind },
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        logger.warn('OrdersContext', 'notifyBuyer failed', { e });
      }
    },
    [user?.id, meName, meAvatar]
  );

  const acceptOrder = useCallback(
    async (order: GrabOrder) => {
      markOrder(order.id, 'accepted');
      await setItemStatus(order, 'accepted');
      await notifyBuyer(order, 'accepted', `Your order is accepted — ready to get started on "${order.itemTitle}".`, '✅');
    },
    [markOrder, setItemStatus, notifyBuyer]
  );

  const fulfillOrder = useCallback(
    async (order: GrabOrder) => {
      markOrder(order.id, 'fulfilled');
      await setItemStatus(order, 'fulfilled');
      await notifyBuyer(order, 'fulfilled', `Your order for "${order.itemTitle}" is complete. Thanks!`, '🎉');
    },
    [markOrder, setItemStatus, notifyBuyer]
  );

  /**
   * A declined grab gives its spot back: one less grab on the listing, and a
   * listing that had closed because it was full opens again.
   */
  const releaseSpot = useCallback(async (order: GrabOrder) => {
    const table = order.kind === 'bundle' ? 'bundles' : order.kind === 'skill' ? 'skill_deals' : null;
    if (!table || !order.itemId || !user?.id) return;
    try {
      const { data, error } = await supabase.from(table).select('grabs, available_count, status').eq('id', order.itemId).maybeSingle();
      if (error || !data) return;
      const grabs = Math.max(Number(data.grabs) || 0, 0);
      const spots = Math.max(Number(data.available_count) || (table === 'bundles' ? 1 : 20), 1);
      if (grabs <= 0) return;
      const patch: Record<string, unknown> = { grabs: grabs - 1 };
      // It closed itself when it filled up, so reopen it now there's room.
      if (data.status === 'paused' && grabs >= spots) patch.status = 'active';
      const { error: upErr } = await supabase.from(table).update(patch).eq('id', order.itemId);
      if (upErr) logger.warn('OrdersContext', 'releaseSpot failed', { error: upErr.message });
    } catch (e) {
      logger.warn('OrdersContext', 'releaseSpot failed', { e });
    }
  }, [user?.id]);

  const declineOrder = useCallback(
    async (order: GrabOrder) => {
      const wasDeclined = order.status === 'declined';
      markOrder(order.id, 'declined');
      await setItemStatus(order, 'declined');
      if (!wasDeclined) await releaseSpot(order);
      await notifyBuyer(order, 'declined', `Sorry — the order for "${order.itemTitle}" couldn't be accepted right now.`, '🙏');
    },
    [markOrder, setItemStatus, notifyBuyer, releaseSpot]
  );

  const refresh = useCallback(() => {
    setLoading(true);
    loadOrders();
  }, [loadOrders]);

  const value = useMemo<OrdersContextValue>(() => {
    const pendingCount = orders.filter((o) => o.status === 'requested').length;
    return { orders, pendingCount, loading, refresh, acceptOrder, fulfillOrder, declineOrder };
  }, [orders, loading, refresh, acceptOrder, fulfillOrder, declineOrder]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider');
  return ctx;
}
