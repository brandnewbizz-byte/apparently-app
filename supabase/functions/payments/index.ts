// In-app payments between members, with Stripe Connect: direct charges on the
// seller's own connected account (full Stripe Dashboard, Stripe-managed risk), so the
// seller is the merchant, handles their own refunds/disputes, and pays Stripe's
// card fee; Apparently takes an application fee. The signed-in user's JWT says who is calling.
//
// POST { action: 'health' }                       -> { ok }  is the platform Stripe key valid
// POST { action: 'status' }                       -> { connected, charges_enabled, payouts_enabled, details_submitted, needs_info }
// POST { action: 'onboard', return_url }          -> { url }  Stripe-hosted payout setup for the caller
// POST { action: 'dashboard' }                    -> { url }  the seller's Stripe dashboard (payouts, balance, refunds)
// POST { action: 'checkout', request_id, return_url } -> { url }  buyer pays a payment request
// POST { action: 'confirm', request_id }          -> { status } re-check a request with Stripe, mark it paid
//
// Needs the secret STRIPE_SECRET_KEY (the platform's Stripe key, with Connect turned on).
// Apparently's fees: PLATFORM_FEE_PERCENT (default 10) of the seller's price, plus a buyer
// service fee of BUYER_FEE_PERCENT (default 5) added on top at checkout. Both go to the
// platform automatically; the seller keeps their price minus 10% and Stripe's card fee.
// Checkout shows Apple Pay / Google Pay automatically where the buyer's device supports it.
import { createClient } from 'npm:@supabase/supabase-js@2.93.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Saved in the dashboard as Stripe_Secret_key; accept either spelling.
const STRIPE_KEY = (Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('Stripe_Secret_key') || '').trim();
const FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') || '10');
// Buyer service fee, added on top of the seller's price and kept by Apparently.
const BUYER_FEE_PERCENT = Number(Deno.env.get('BUYER_FEE_PERCENT') || '5');
const WEB_APP = 'https://apparentlyappdashboard.nationalcompliancehub.com/app';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Only send people back to our own app (web, or the native app's scheme). */
function safeReturn(url: unknown, fallback: string): string {
  if (typeof url !== 'string') return fallback;
  if (url.startsWith(WEB_APP) || url.startsWith('rork-app://') || url.startsWith('exp://')) return url;
  return fallback;
}

function form(params: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) out.push(...form(v as Record<string, unknown>, key));
    else if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === 'object') out.push(...form(item as Record<string, unknown>, `${key}[${i}]`));
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
    });
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

async function stripe(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>, onAccount?: string) {
  const body = params ? form(params).join('&') : undefined;
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (onAccount) headers['Stripe-Account'] = onAccount;
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method,
    headers,
    body: method === 'POST' ? body : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

async function syncAccount(userId: string, accountId: string) {
  const acct = await stripe('GET', `accounts/${accountId}`);
  const row = {
    user_id: userId, stripe_account_id: accountId,
    charges_enabled: !!acct.charges_enabled, payouts_enabled: !!acct.payouts_enabled,
    details_submitted: !!acct.details_submitted, updated_at: new Date().toISOString(),
  };
  await admin.from('payout_accounts').upsert(row, { onConflict: 'user_id' });
  const due = [...(acct.requirements?.currently_due || []), ...(acct.requirements?.past_due || [])];
  return { ...row, needs_info: due.length > 0 };
}

/** Mark a request paid (once) and tell the seller. */
async function markPaid(pr: Record<string, any>, session: Record<string, any>) {
  const { data: changed } = await admin.from('payment_requests').update({
    status: 'paid', paid_at: new Date().toISOString(), payment_intent_id: session.payment_intent || null,
  }).eq('id', pr.id).eq('status', 'requested').select('id');
  if (!changed || changed.length === 0) return; // someone else already marked it
  try {
    const { data: buyer } = await admin.from('profiles').select('full_name, username, avatar').eq('id', pr.buyer_id).maybeSingle();
    const name = buyer?.full_name || buyer?.username || 'Someone';
    const amount = `$${(pr.amount_cents / 100).toFixed(pr.amount_cents % 100 === 0 ? 0 : 2)}`;
    const text = `${name} paid ${amount} for "${pr.title}" 💸`;
    await admin.from('notifications').insert({
      user_id: pr.seller_id, actor_id: pr.buyer_id, actor_name: name, actor_avatar: buyer?.avatar || '',
      type: 'general', title: text, body: text, read: false,
      data: { subject: 'paid', emoji: '💸', payment_request_id: pr.id, item_id: pr.item_id, item_title: pr.title, amount_cents: pr.amount_cents },
    });
  } catch (_) { /* the payment itself is recorded; the heads-up is best effort */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // Allow whatever headers the Supabase client asks for (it adds new x-supabase-* ones over time).
    const asked = req.headers.get('Access-Control-Request-Headers');
    return new Response('ok', { headers: asked ? { ...cors, 'Access-Control-Allow-Headers': asked } : cors });
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!STRIPE_KEY) return json({ error: 'payments_not_configured' }, 503);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'not_signed_in' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body.action || '');

  try {
    const { data: existing } = await admin.from('payout_accounts').select('*').eq('user_id', user.id).maybeSingle();

    if (action === 'health') {
      // Is the platform's Stripe key valid? Reports a yes/no only.
      const r = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
      return json({ ok: r.ok });
    }

    if (action === 'status') {
      if (!existing) return json({ connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false, needs_info: true });
      const row = await syncAccount(user.id, existing.stripe_account_id);
      return json({ connected: true, charges_enabled: row.charges_enabled, payouts_enabled: row.payouts_enabled, details_submitted: row.details_submitted, needs_info: row.needs_info });
    }

    if (action === 'onboard') {
      let accountId = existing?.stripe_account_id as string | undefined;
      if (!accountId) {
        const acct = await stripe('POST', 'accounts', {
          country: 'US', email: user.email,
          // Full Stripe Dashboard; the seller pays Stripe's fees; Stripe manages risk and covers losses.
          // (Stripe only allows Stripe-covered losses with the full dashboard, not the Express one.)
          controller: { stripe_dashboard: { type: 'full' }, fees: { payer: 'account' }, losses: { payments: 'stripe' }, requirement_collection: 'stripe' },
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: { product_description: 'Services and packages sold on Apparently' },
          metadata: { apparently_user_id: user.id },
        });
        accountId = acct.id as string;
        await admin.from('payout_accounts').upsert({ user_id: user.id, stripe_account_id: accountId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      }
      const back = safeReturn(body.return_url, `${WEB_APP}/payouts`);
      const link = await stripe('POST', 'account_links', {
        account: accountId, type: 'account_onboarding', refresh_url: back, return_url: back,
      });
      return json({ url: link.url });
    }

    if (action === 'dashboard') {
      if (!existing) return json({ error: 'no_payout_account' }, 400);
      // Sellers sign in to their own full Stripe Dashboard.
      return json({ url: 'https://dashboard.stripe.com/' });
    }

    if (action === 'checkout' || action === 'confirm') {
      const requestId = String(body.request_id || '');
      const { data: pr } = await admin.from('payment_requests').select('*').eq('id', requestId).maybeSingle();
      if (!pr || (pr.buyer_id !== user.id && pr.seller_id !== user.id)) return json({ error: 'not_found' }, 404);
      const { data: seller } = await admin.from('payout_accounts').select('*').eq('user_id', pr.seller_id).maybeSingle();
      const sellerAcct = seller?.stripe_account_id as string | undefined;

      if (action === 'confirm') {
        if (pr.status !== 'requested' || !pr.checkout_session_id || !sellerAcct) return json({ status: pr.status });
        const session = await stripe('GET', `checkout/sessions/${pr.checkout_session_id}`, undefined, sellerAcct);
        if (session.payment_status === 'paid') {
          await markPaid(pr, session);
          return json({ status: 'paid' });
        }
        return json({ status: pr.status });
      }

      // checkout: only the buyer pays an open request
      if (pr.buyer_id !== user.id) return json({ error: 'only_buyer_pays' }, 403);
      if (pr.status !== 'requested') return json({ error: `already_${pr.status}` }, 409);
      // A checkout opened earlier may already have gone through.
      if (!sellerAcct) return json({ error: 'seller_not_ready' }, 409);
      if (pr.checkout_session_id) {
        const prev = await stripe('GET', `checkout/sessions/${pr.checkout_session_id}`, undefined, sellerAcct);
        if (prev.payment_status === 'paid') {
          await markPaid(pr, prev);
          return json({ error: 'already_paid' }, 409);
        }
        if (prev.status === 'open' && prev.url) return json({ url: prev.url });
      }
      const fresh = await syncAccount(pr.seller_id, sellerAcct);
      if (!fresh.charges_enabled) return json({ error: 'seller_not_ready' }, 409);

      const serviceFee = Math.round(pr.amount_cents * BUYER_FEE_PERCENT / 100);
      const fee = Math.round(pr.amount_cents * FEE_PERCENT / 100) + serviceFee;
      const back = safeReturn(body.return_url, `${WEB_APP}/inbox`);
      const sep = back.includes('?') ? '&' : '?';
      const session = await stripe('POST', 'checkout/sessions', {
        mode: 'payment',
        line_items: [
          { quantity: 1, price_data: { currency: 'usd', unit_amount: pr.amount_cents, product_data: { name: pr.title.slice(0, 120) } } },
          ...(serviceFee > 0 ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: serviceFee, product_data: { name: 'Apparently service fee' } } }] : []),
        ],
        payment_intent_data: {
          application_fee_amount: fee,
          description: `Apparently: ${pr.title}`.slice(0, 200),
          metadata: { payment_request_id: pr.id, seller_id: pr.seller_id, buyer_id: pr.buyer_id },
        },
        customer_email: user.email,
        client_reference_id: pr.id,
        metadata: { payment_request_id: pr.id },
        success_url: `${back}${sep}paid=${pr.id}`,
        cancel_url: back,
      }, sellerAcct);
      await admin.from('payment_requests').update({ checkout_session_id: session.id, fee_cents: fee, service_fee_cents: serviceFee }).eq('id', pr.id);
      return json({ url: session.url });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: 'stripe_error', message: String((e as Error).message || e) }, 502);
  }
});
