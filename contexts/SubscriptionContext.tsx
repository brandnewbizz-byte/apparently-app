import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { initPurchases, onCustomerInfoChange, resetPurchasesUser, purchasesAvailable } from '@/lib/purchases';
import { planFor, type PaywallReason, type Tier, type TierLimits } from '@/lib/plans';

export interface PlanState {
  loaded: boolean;
  /** False when the subscription tables aren't in the database yet — nothing is limited then. */
  enforced: boolean;
  tier: Tier;
  status: string;
  isTrial: boolean;
  periodEnd: string | null;
  willRenew: boolean | null;
  store: string | null;
  limits: TierLimits;
  actionsUsed: number;
  actionsResetAt: string | null;
  listingsActive: number;
  roomsOwned: number;
  storageUsed: number;
  isAdmin: boolean;
}

const EMPTY: PlanState = {
  loaded: false, enforced: false, tier: 'free', status: 'inactive', isTrial: false, periodEnd: null, willRenew: null, store: null,
  limits: planFor('free').limits, actionsUsed: 0, actionsResetAt: null, listingsActive: 0, roomsOwned: 0, storageUsed: 0, isAdmin: false,
};

type CardAction = 'grab' | 'skip' | 'save';

interface SubscriptionValue {
  plan: PlanState;
  refresh: () => Promise<PlanState>;
  /** Spend one Home-card action. Opens the paywall and returns false when out. */
  spendAction: (action: CardAction, itemType: string, itemId: string) => Promise<boolean>;
  /** Can I post a bundle / skill / request / job right now? Opens the paywall if not. */
  requireListing: () => Promise<boolean>;
  /** Can I use Spot (and create a room when `create`)? */
  requireSpot: (opts?: { create?: boolean; invited?: boolean }) => Promise<boolean>;
  /** Room for an upload of this size? */
  checkUpload: (bytes: number) => Promise<boolean>;
  openPaywall: (reason: PaywallReason) => void;
  /** After a purchase / restore: ask the server to re-check with the store. */
  syncWithStore: () => Promise<void>;
}

const Ctx = createContext<SubscriptionValue | null>(null);

function mapPlan(d: any): PlanState {
  return {
    loaded: true,
    // Only gate features where people can actually buy a plan on this device (App Store rule:
    // never lock a feature behind a purchase that can't be made). Turns on by itself once the
    // store key for this platform is set in constants/app.ts.
    enforced: d?.enforced !== false && purchasesAvailable(),
    tier: (d?.tier || 'free') as Tier,
    status: d?.status || 'inactive',
    isTrial: !!d?.is_trial,
    periodEnd: d?.period_end || null,
    willRenew: d?.will_renew ?? null,
    store: d?.store || null,
    limits: { ...planFor(d?.tier).limits, ...(d?.limits || {}) },
    actionsUsed: Number(d?.actions_used) || 0,
    actionsResetAt: d?.actions_reset_at || null,
    listingsActive: Number(d?.listings_active) || 0,
    roomsOwned: Number(d?.rooms_owned) || 0,
    storageUsed: Number(d?.storage_used) || 0,
    isAdmin: !!d?.is_admin,
  };
}

let paywallOpen = false;
function showPaywall(reason: PaywallReason) {
  if (paywallOpen) return;
  paywallOpen = true;
  setTimeout(() => { paywallOpen = false; }, 800);
  router.push({ pathname: '/paywall' as any, params: { reason } });
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [plan, setPlan] = useState<PlanState>(EMPTY);
  const planRef = useRef(plan);
  planRef.current = plan;

  const refresh = useCallback(async (): Promise<PlanState> => {
    if (!userId) { setPlan(EMPTY); return EMPTY; }
    const { data, error } = await supabase.rpc('my_plan');
    if (error) {
      // Database without subscriptions yet: don't block anything.
      const next = { ...EMPTY, loaded: true, enforced: false };
      if (!/my_plan|function|schema cache/i.test(error.message || '')) logger.warn('Subscription', 'my_plan failed', { error: error.message });
      setPlan(next);
      return next;
    }
    const next = mapPlan(data);
    setPlan(next);
    return next;
  }, [userId]);

  const syncWithStore = useCallback(async () => {
    try {
      await supabase.functions.invoke('revenuecat', { body: { action: 'sync' } });
    } catch (e: any) {
      logger.warn('Subscription', 'store sync failed', { error: e?.message });
    }
    await refresh();
  }, [refresh]);

  // Load on sign-in, connect RevenueCat to this user, refresh when the app returns.
  useEffect(() => {
    if (!userId) { setPlan(EMPTY); resetPurchasesUser(); return; }
    refresh();
    initPurchases(userId).then(() => undefined);
    const off = onCustomerInfoChange(() => { syncWithStore(); });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { off(); sub.remove(); };
  }, [userId, refresh, syncWithStore]);

  const openPaywall = useCallback((reason: PaywallReason) => showPaywall(reason), []);

  const spendAction = useCallback(async (action: CardAction, itemType: string, itemId: string) => {
    const p = planRef.current;
    if (!purchasesAvailable()) return true;
    if (p.loaded && !p.enforced) return true;
    if (p.loaded && p.isAdmin) return true;
    const { data, error } = await supabase.rpc('use_card_action', { p_action: action, p_item_type: itemType, p_item_id: itemId });
    if (error) {
      // Never block people because of a network blip.
      logger.warn('Subscription', 'use_card_action failed', { error: error.message });
      return true;
    }
    const r = data as any;
    if (r?.ok) {
      setPlan((prev) => ({ ...prev, actionsUsed: prev.actionsUsed + 1 }));
      return true;
    }
    if (r?.reason === 'needs_plan') { showPaywall('save'); return false; }
    if (r?.reason === 'limit') {
      setPlan((prev) => ({ ...prev, actionsUsed: Number(r.used) || prev.actionsUsed, actionsResetAt: r.resets_at || prev.actionsResetAt }));
      showPaywall('actions');
      return false;
    }
    return true;
  }, []);

  const requireListing = useCallback(async () => {
    const p = await refresh();
    if (!p.enforced || p.isAdmin) return true;
    const cap = p.limits.listings;
    if (p.tier !== 'free' && (cap == null || p.listingsActive < cap)) return true;
    showPaywall('listing');
    return false;
  }, [refresh]);

  const requireSpot = useCallback(async (opts?: { create?: boolean; invited?: boolean }) => {
    const p = planRef.current.loaded ? planRef.current : await refresh();
    if (!p.enforced || p.isAdmin) return true;
    if (opts?.create) {
      const cap = p.limits.spot_rooms;
      if (p.tier !== 'free' && (cap == null || p.roomsOwned < cap)) return true;
      showPaywall('spot');
      return false;
    }
    // Invited guests can join a member's room; using Spot otherwise needs a plan.
    if (p.tier !== 'free' || opts?.invited) return true;
    showPaywall('spot');
    return false;
  }, [refresh]);

  const checkUpload = useCallback(async (bytes: number) => {
    const p = planRef.current;
    if (p.loaded && (!p.enforced || p.isAdmin)) return true;
    const { data, error } = await supabase.rpc('can_upload', { p_bytes: Math.max(0, Math.round(bytes || 0)) });
    if (error) return true;
    if ((data as any)?.ok === false && (data as any)?.reason !== 'not_signed_in') {
      showPaywall('storage');
      return false;
    }
    return true;
  }, []);

  const value = useMemo<SubscriptionValue>(() => ({
    plan, refresh, spendAction, requireListing, requireSpot, checkUpload, openPaywall, syncWithStore,
  }), [plan, refresh, spendAction, requireListing, requireSpot, checkUpload, openPaywall, syncWithStore]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSubscription(): SubscriptionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return v;
}

/** Same as useSubscription, but safe outside the provider (returns null). */
export const useSubscriptionOptional = () => useContext(Ctx);
