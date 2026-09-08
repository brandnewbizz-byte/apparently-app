import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export type OrderKind = 'bundle' | 'skill';
export type OrderStatus = 'requested' | 'accepted' | 'fulfilled' | 'declined';

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

const ORDER_TYPES: Record<string, OrderKind> = { bundle_grab: 'bundle', skill_grab: 'skill' };

const ITEM_TABLE: Record<OrderKind, string> = {
  bundle: 'bundles',
  skill: 'skill_deals',
};

// Grab notification `data` carries the item id/title keyed differently per type.
const itemFields: Record<OrderKind, { id: string; title: string }> = {
  bundle: { id: 'bundle_id', title: 'bundle_title' },
  skill: { id: 'skill_id', title: 'skill_title' },
};

// ── Provider ───────────────────────────────────────────────────────────────

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<GrabOrder[]>([]);
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

  const buildOrder = useCallback((n: any): GrabOrder | null => {
    const kind = ORDER_TYPES[n.type];
    if (!kind) return null;
    const extra = n.data || {};
    const fields = itemFields[kind];
    return {
      id: n.id,
      kind,
      itemId: extra[fields.id] || '',
      itemTitle: extra[fields.title] || (kind === 'bundle' ? 'Bundle' : 'Skill'),
      price: extra.price ? Number(extra.price) : undefined,
      buyerId: n.actor_id || '',
      buyerName: n.actor_name || 'Someone',
      buyerAvatar: n.actor_avatar || '',
      status: resolvedMap[n.id] || 'requested',
      createdAt: n.created_at || new Date().toISOString(),
    };
  }, [resolvedMap]);

  const loadOrders = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      // Grab notifications addressed to me = someone grabbing my item.
      const { data, error } = await supabase
        .from('notifications')
        .select('id, actor_id, actor_name, actor_avatar, type, data, created_at')
        .eq('user_id', user.id)
        .in('type', ['bundle_grab', 'skill_grab'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('OrdersContext', 'load grab notifications failed', { error });
        setOrders([]);
        return;
      }
      const rows: GrabOrder[] = (data || [])
        .map(buildOrder)
        .filter((o): o is GrabOrder => o !== null);
      setOrders(rows);
    } catch (e) {
      logger.error('OrdersContext', 'loadOrders exception', { e });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, buildOrder]);

  useEffect(() => {
    if (user?.id) loadOrders();
    else setLoading(false);
  }, [user?.id, loadOrders]);

  const markOrder = useCallback(
    (orderId: string, status: OrderStatus) => {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
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

  const setItemStatus = useCallback(async (order: GrabOrder, status: string) => {
    if (!order.itemId) return;
    try {
      await supabase.from(ITEM_TABLE[order.kind]).update({ status }).eq('id', order.itemId);
    } catch (e) {
      logger.warn('OrdersContext', 'setItemStatus failed', { e });
    }
  }, []);

  const notifyBuyer = useCallback(
    async (order: GrabOrder, subject: string, body: string, emoji: string) => {
      if (!order.buyerId) return;
      try {
        await supabase.from('notifications').insert({
          user_id: order.buyerId,
          actor_id: user?.id,
          actor_name: meName,
          actor_avatar: meAvatar,
          type: order.kind === 'bundle' ? 'bundle_order' : 'skill_order',
          title: body,
          body,
          data: { item_id: order.itemId, item_title: order.itemTitle, subject, emoji },
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
      await setItemStatus(order, 'active'); // order started; service offered
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

  const declineOrder = useCallback(
    async (order: GrabOrder) => {
      markOrder(order.id, 'declined');
      await setItemStatus(order, 'available'); // free it for other buyers
      await notifyBuyer(order, 'declined', `Sorry — the order for "${order.itemTitle}" couldn't be accepted right now.`, '🙏');
    },
    [markOrder, setItemStatus, notifyBuyer]
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
