// Sign in with a username instead of an email.
//
// The email behind a username stays on the server: we look it up with the
// service role, ask Supabase Auth to check the password, and hand back the
// session. The old `resolve_login_email` RPC returned the email to anyone who
// knew a username, which leaked every user's address.
//
// POST { username, password }
//   200 { session }                          -> app calls supabase.auth.setSession()
//   400 { error: 'invalid_credentials' }     -> wrong username or password
//   400 { error: 'email_not_confirmed', email } (only after the password was right)
//   429 { error: 'rate_limited' }
import { createClient } from 'npm:@supabase/supabase-js@2.93.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const started = Date.now();
  // Same timing whether or not the username exists, so it can't be probed.
  const fail = async (status: number, body: Record<string, unknown>) => {
    const wait = 600 - (Date.now() - started);
    if (wait > 0) await sleep(wait);
    return json(body, status);
  };

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '').trim().toLowerCase().replace(/^@/, '');
    password = String(body?.password ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!/^[a-z0-9._]{3,30}$/.test(username) || password.length < 6 || password.length > 200) {
    return fail(400, { error: 'invalid_credentials' });
  }

  const { data: row } = await admin.from('profiles').select('email').eq('username', username).limit(1).maybeSingle(); // usernames are stored lowercase
  const email = (row?.email || '').trim().toLowerCase();
  if (!email) return fail(400, { error: 'invalid_credentials' });

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      // Let Auth's per-IP rate limit see the real caller.
      ...(req.headers.get('x-forwarded-for') ? { 'X-Forwarded-For': req.headers.get('x-forwarded-for')! } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  const out = await res.json().catch(() => ({}));

  if (res.ok && out?.access_token) {
    return json({
      session: {
        access_token: out.access_token,
        refresh_token: out.refresh_token,
        expires_in: out.expires_in,
        expires_at: out.expires_at,
        token_type: out.token_type,
      },
    });
  }

  const code = out?.error_code || out?.code || '';
  if (res.status === 429 || code === 'over_request_rate_limit') return fail(429, { error: 'rate_limited' });
  // Auth only says "not confirmed" after the password checked out, so the
  // caller already proved they own the account; they need the address to resend.
  if (code === 'email_not_confirmed') return fail(400, { error: 'email_not_confirmed', email });
  return fail(400, { error: 'invalid_credentials' });
});
