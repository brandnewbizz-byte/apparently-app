/**
 * In-app payments between members: a seller asks for the agreed amount in a chat,
 * the buyer pays it on Stripe Checkout, and Stripe sends the money to the seller's
 * bank minus Apparently's fee. Server side: supabase/functions/payments.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { WEB_APP_URL } from '@/lib/profileLink';

export const PLATFORM_FEE_PERCENT = 10;
export const MIN_PAYMENT = 1;
export const MAX_PAYMENT = 20000;

export type PaymentStatus = 'requested' | 'paid' | 'canceled';
export interface PaymentRequest {
  id: string; seller_id: string; buyer_id: string; title: string; amount_cents: number;
  fee_cents: number; status: PaymentStatus; created_at: string; paid_at: string | null;
  /** The listing the payment is for (bundle / skill / service id), when it came from an order. */
  item_id?: string | null; item_type?: string | null;
  /** Set once the buyer has opened Stripe Checkout. */
  checkout_session_id?: string | null;
}

/** What a payment request is for, when it belongs to an order. */
export interface PaymentFor { itemId?: string; itemType?: string }
export interface PayoutStatus {
  connected: boolean; charges_enabled: boolean; payouts_enabled: boolean;
  /** The seller finished Stripe's form. */
  details_submitted?: boolean;
  /** Stripe still needs something from the seller. */
  needs_info?: boolean;
}
/** Signed up and nothing left to fill in, but Stripe is still verifying (usually minutes). */
export const isVerifying = (st: PayoutStatus | null) => !!st && st.connected && !st.charges_enabled && !!st.details_submitted && !st.needs_info;

const MESSAGES: Record<string, string> = {
  payments_not_configured: 'Payments aren’t switched on yet. Please try again soon.',
  not_signed_in: 'Please sign in again.',
  seller_not_ready: 'This seller hasn’t finished setting up payouts yet. Ask them to finish it in Settings → Get paid.',
  already_paid: 'This has already been paid.',
  already_canceled: 'This request was canceled.',
  only_buyer_pays: 'Only the person it was sent to can pay it.',
  not_found: 'We couldn’t find this payment request.',
};

export class PaymentsError extends Error {
  code: string;
  constructor(code: string, message?: string) { super(MESSAGES[code] || message || 'Something went wrong with the payment. Please try again.'); this.code = code; }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payments', { body });
  if (error) {
    let code = 'error'; let message: string | undefined;
    try {
      const res = (error as { context?: Response }).context;
      if (res && typeof res.json === 'function') { const j = await res.json(); code = j.error || code; message = j.message; }
    } catch { /* not JSON */ }
    throw new PaymentsError(code, message);
  }
  return data as T;
}

/** Where Stripe sends people back to: this page on the web, the web app otherwise. */
function here(fallbackPath: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.href.split('#')[0];
  return `${WEB_APP_URL}${fallbackPath}`;
}

/** Opens a Stripe page. On phones it opens in an in-app browser and resolves when it's closed. */
export async function openStripePage(url: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') { window.location.assign(url); return; }
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}

export const getPayoutStatus = () => call<PayoutStatus>({ action: 'status' });

export async function startPayoutSetup(returnPath = '/payouts') {
  const { url } = await call<{ url: string }>({ action: 'onboard', return_url: here(returnPath) });
  await openStripePage(url);
}

export async function openPayoutDashboard() {
  const { url } = await call<{ url: string }>({ action: 'dashboard' });
  await openStripePage(url);
}

export async function createPaymentRequest(buyerId: string, title: string, amount: number, forOrder?: PaymentFor): Promise<PaymentRequest> {
  const { data, error } = await supabase.from('payment_requests')
    .insert({
      buyer_id: buyerId, title: title.trim().slice(0, 120), amount_cents: Math.round(amount * 100),
      item_id: forOrder?.itemId || null, item_type: forOrder?.itemType || null,
    })
    .select('*').single();
  if (error) throw new PaymentsError('error', error.message);
  return data as PaymentRequest;
}

export async function cancelPaymentRequest(id: string) {
  const { error } = await supabase.from('payment_requests').update({ status: 'canceled' }).eq('id', id);
  if (error) throw new PaymentsError('error', error.message);
}

/** Buyer: pay a request on Stripe Checkout, then check whether it went through. */
export async function payPaymentRequest(id: string, returnPath = '/inbox'): Promise<PaymentStatus> {
  const { url } = await call<{ url: string }>({ action: 'checkout', request_id: id, return_url: here(returnPath) });
  await openStripePage(url);
  return confirmPaymentRequest(id);
}

export async function confirmPaymentRequest(id: string): Promise<PaymentStatus> {
  const { status } = await call<{ status: PaymentStatus }>({ action: 'confirm', request_id: id });
  return status;
}

export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
/** Stripe's US card fee, paid by the seller (sellers are the merchant on their own sales). */
export const STRIPE_FEE = { percent: 2.9, fixedCents: 30 };
/** About what the seller keeps: the price minus Apparently's fee and Stripe's card fee. */
export const sellerGets = (cents: number) =>
  Math.max(0, cents - Math.round(cents * PLATFORM_FEE_PERCENT / 100) - Math.round(cents * STRIPE_FEE.percent / 100) - STRIPE_FEE.fixedCents);

/** Live status of one request (refreshes when asked, and every 15s while it's open). */
export function usePaymentRequest(id?: string) {
  const [req, setReq] = useState<PaymentRequest | null>(null);
  const refresh = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('payment_requests').select('*').eq('id', id).maybeSingle();
    if (data) setReq(data as PaymentRequest);
  }, [id]);
  useEffect(() => { Promise.resolve().then(refresh); }, [refresh]);
  useEffect(() => {
    if (!id || req?.status !== 'requested') return;
    // While it's open, ask Stripe now and then too, so it flips to Paid even if
    // the buyer never came back to the app after paying.
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n % 2 === 0 && req?.checkout_session_id) confirmPaymentRequest(id).catch(() => {}).finally(refresh);
      else refresh();
    }, 15000);
    return () => clearInterval(t);
  }, [id, req?.status, req?.checkout_session_id, refresh]);
  return { req, refresh };
}

/** Key that ties a payment request to an order: who sells, who pays, and for which listing. */
export const orderPaymentKey = (sellerId: string, buyerId: string, itemId: string) => `${sellerId}:${buyerId}:${itemId}`;

/**
 * Every payment request I'm part of (as seller or buyer), keyed by order, newest
 * first per order. Manage uses it to show Requested / Paid on each order.
 */
export function useMyPaymentRequests(userId?: string) {
  const [byOrder, setByOrder] = useState<Record<string, PaymentRequest>>({});
  const [all, setAll] = useState<PaymentRequest[]>([]);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('payment_requests').select('*')
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
      .order('created_at', { ascending: false }).limit(500);
    let rows = (data || []) as PaymentRequest[];
    // Open requests the buyer has started paying: check with Stripe (a few at a time).
    const pending = rows.filter((r) => r.status === 'requested' && r.checkout_session_id).slice(0, 5);
    if (pending.length) {
      const results = await Promise.all(pending.map((r) => confirmPaymentRequest(r.id).catch(() => null)));
      const nowPaid = new Set(pending.filter((_, i) => results[i] === 'paid').map((r) => r.id));
      if (nowPaid.size) rows = rows.map((r) => (nowPaid.has(r.id) ? { ...r, status: 'paid' as const, paid_at: r.paid_at || new Date().toISOString() } : r));
    }
    const map: Record<string, PaymentRequest> = {};
    for (const r of rows) {
      if (!r.item_id) continue;
      const k = orderPaymentKey(r.seller_id, r.buyer_id, r.item_id);
      const cur = map[k];
      // Prefer a paid request, then an open one, then the newest.
      const rank = (x: PaymentRequest) => (x.status === 'paid' ? 2 : x.status === 'requested' ? 1 : 0);
      if (!cur || rank(r) > rank(cur)) map[k] = r;
    }
    setAll(rows);
    setByOrder(map);
  }, [userId]);
  useEffect(() => { Promise.resolve().then(refresh); }, [refresh]);
  useEffect(() => {
    if (!userId) return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [userId, refresh]);
  return { byOrder, all, refresh };
}

/**
 * The payment request tied to an order. On bundle/skill orders I'm the seller and
 * `o.buyerId` pays; on a service order the helper (`o.buyerId`) sells to me.
 */
export function paymentForOrder(
  byOrder: Record<string, PaymentRequest>, myId: string | undefined,
  o: { kind: string; itemId: string; buyerId: string },
): PaymentRequest | undefined {
  if (!myId || !o.itemId || !o.buyerId) return undefined;
  return o.kind === 'service'
    ? byOrder[orderPaymentKey(o.buyerId, myId, o.itemId)]
    : byOrder[orderPaymentKey(myId, o.buyerId, o.itemId)];
}
