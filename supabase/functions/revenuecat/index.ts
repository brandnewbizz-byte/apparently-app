// RevenueCat → Supabase subscription sync.
//
// Two ways in:
//  1. RevenueCat webhook  — Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
//  2. The app, right after a purchase/restore — Authorization: Bearer <user JWT>,
//     body {"action":"sync"}.
// Either way we ask RevenueCat's REST API for the subscriber's real state
// (when REVENUECAT_SECRET_API_KEY is set) and write public.subscriptions.
// Clients can never write that table themselves.
import { createClient } from 'npm:@supabase/supabase-js@2.93.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') || '';
const RC_SECRET = Deno.env.get('REVENUECAT_SECRET_API_KEY') || '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RANK: Record<string, number> = { free: 0, basic: 1, plus: 2, pro: 3 };
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

interface State {
  tier: string; status: string; is_trial: boolean; product_id: string | null;
  store: string | null; period_end: string | null; will_renew: boolean | null;
}

/** Read the subscriber from RevenueCat and work out the best active tier. */
async function fromRevenueCat(userId: string): Promise<State | null> {
  if (!RC_SECRET) return null;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${RC_SECRET}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  const sub = (await res.json()).subscriber || {};
  const ents: Record<string, any> = sub.entitlements || {};
  const subs: Record<string, any> = sub.subscriptions || {};
  const now = Date.now();
  let best: State = { tier: 'free', status: 'expired', is_trial: false, product_id: null, store: null, period_end: null, will_renew: null };
  for (const [id, e] of Object.entries(ents)) {
    const tier = id.toLowerCase();
    if (!(tier in RANK)) continue;
    const exp = e.expires_date ? Date.parse(e.expires_date) : Infinity;
    const grace = e.grace_period_expires_date ? Date.parse(e.grace_period_expires_date) : 0;
    if (exp <= now && grace <= now) continue;
    if (RANK[tier] <= RANK[best.tier]) continue;
    const s = subs[e.product_identifier] || {};
    const trial = s.period_type === 'trial';
    const cancelled = !!s.unsubscribe_detected_at;
    best = {
      tier,
      status: exp <= now ? 'grace' : trial ? 'trialing' : cancelled ? 'cancelled' : 'active',
      is_trial: trial,
      product_id: e.product_identifier || null,
      store: s.store || null,
      period_end: e.expires_date || null,
      will_renew: !cancelled,
    };
  }
  return best;
}

/** Fallback when there is no REST key: trust the (authenticated) webhook event. */
function fromEvent(ev: any): State {
  const ids: string[] = (ev.entitlement_ids || (ev.entitlement_id ? [ev.entitlement_id] : [])).map((x: string) => x.toLowerCase());
  const tier = ids.filter((x) => x in RANK).sort((a, b) => RANK[b] - RANK[a])[0] || 'free';
  const exp = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
  const ended = ev.type === 'EXPIRATION' || (ev.expiration_at_ms && ev.expiration_at_ms < Date.now());
  const trial = ev.period_type === 'TRIAL';
  return {
    tier: ended ? 'free' : tier,
    status: ended ? 'expired' : ev.type === 'CANCELLATION' ? 'cancelled' : ev.type === 'BILLING_ISSUE' ? 'grace' : trial ? 'trialing' : 'active',
    is_trial: trial && !ended,
    product_id: ev.product_id || null,
    store: ev.store || null,
    period_end: exp,
    will_renew: ev.type === 'CANCELLATION' || ended ? false : true,
  };
}

async function save(userId: string, s: State) {
  const { error } = await admin.from('subscriptions').upsert({ user_id: userId, ...s, updated_at: new Date().toISOString() });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const body = await req.json().catch(() => ({}));

  try {
    // 1. Webhook from RevenueCat
    if (WEBHOOK_SECRET && auth === WEBHOOK_SECRET) {
      const ev = body.event || {};
      const ids = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases || []), ...(ev.transferred_to || [])]
        .filter((x: unknown): x is string => typeof x === 'string' && isUuid(x));
      for (const id of [...new Set(ids)]) {
        const state = (await fromRevenueCat(id)) || fromEvent(ev);
        await save(id, state);
      }
      return json({ ok: true, users: ids.length });
    }

    // 2. The app asking to refresh its own subscription
    const { data: { user } } = await admin.auth.getUser(auth);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const state = await fromRevenueCat(user.id);
    if (!state) return json({ ok: false, reason: 'revenuecat_not_configured' }, 200);
    await save(user.id, state);
    return json({ ok: true, tier: state.tier, status: state.status });
  } catch (e) {
    console.error('[revenuecat]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500);
  }
});
