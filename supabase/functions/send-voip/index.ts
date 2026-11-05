// supabase/functions/send-voip/index.ts
//
// Sends an incoming call to an iPhone as a VoIP push (Apple PushKit), so it
// rings on the system call screen (CallKit) even when the app is closed or the
// phone is locked. Called by `dispatch_push` (migration 036) for call
// notifications when the recipient's phone saved a VoIP token.
//
// APNs requires HTTP/2, which Postgres' pg_net can't do — hence this function.
// If anything goes wrong (keys not set, token expired, APNs down) it sends the
// regular Expo push instead, so a call is never lost.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   APNS_KEY_P8     contents of the .p8 key from developer.apple.com → Keys (Apple Push Notifications service)
//   APNS_KEY_ID     that key's 10-character Key ID
//   APNS_TEAM_ID    the Apple Developer Team ID
//   APNS_BUNDLE_ID  app.rork.apparently-app-real-app (optional, this is the default)
//   SEND_PUSH_SECRET optional shared secret; must match the vault secret `send_push_secret`
//
// Deploy without JWT verification (it's called from the database):
//   supabase functions deploy send-voip --no-verify-jwt

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const APNS_HOSTS = ['https://api.push.apple.com', 'https://api.sandbox.push.apple.com'];
const RING_SECONDS = 45;

interface Body {
  recipientId?: string;
  voipToken: string;
  call: Record<string, unknown>;
  fallback?: Record<string, unknown> | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ── APNs provider token (ES256 JWT), reused for up to 50 minutes ──

let cachedJwt: { token: string; at: number } | null = null;

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function apnsJwt(): Promise<string | null> {
  const p8 = Deno.env.get('APNS_KEY_P8');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!p8 || !keyId || !teamId) return null;
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60_000) return cachedJwt.token;

  const pem = p8.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const input = `${header}.${claims}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input));
  const token = `${input}.${b64url(sig)}`;
  cachedJwt = { token, at: Date.now() };
  return token;
}

/** 'ok' | 'bad_token' (wrong or expired token) | 'failed' */
async function sendVoip(token: string, call: Record<string, unknown>): Promise<'ok' | 'bad_token' | 'failed'> {
  const jwt = await apnsJwt();
  if (!jwt) return 'failed';
  const topic = `${Deno.env.get('APNS_BUNDLE_ID') || 'app.rork.apparently-app-real-app'}.voip`;
  const payload = JSON.stringify({ aps: {}, call });
  let badToken = false;
  // App Store / TestFlight builds use production APNs, development builds the sandbox.
  for (const host of APNS_HOSTS) {
    try {
      const res = await fetch(`${host}/3/device/${token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': topic,
          'apns-push-type': 'voip',
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + RING_SECONDS),
        },
        body: payload,
      });
      if (res.ok) return 'ok';
      const reason = (await res.json().catch(() => ({})))?.reason as string | undefined;
      console.error('[send-voip] APNs', host, res.status, reason);
      if (reason === 'BadDeviceToken' || reason === 'Unregistered' || res.status === 410) { badToken = true; continue; }
      if (reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken') cachedJwt = null;
      return 'failed';
    } catch (e) {
      console.error('[send-voip] APNs request failed', host, e);
    }
  }
  return badToken ? 'bad_token' : 'failed';
}

async function clearVoipToken(recipientId: string, token: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  await fetch(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(recipientId)}&voip_token=eq.${encodeURIComponent(token)}`,
    {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ voip_token: null, voip_token_updated_at: null }),
    },
  ).catch(() => {});
}

async function sendFallback(msg?: Record<string, unknown> | null) {
  if (!msg || !msg.to) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(msg),
  }).catch((e) => console.error('[send-voip] fallback push failed', e));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('SEND_PUSH_SECRET');
  if (secret && req.headers.get('x-send-push-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!body?.voipToken || !body.call) return json({ error: 'Missing voipToken/call' }, 400);

  const result = await sendVoip(body.voipToken, body.call);
  if (result === 'ok') return json({ ok: true, via: 'voip' });

  if (result === 'bad_token' && body.recipientId) await clearVoipToken(body.recipientId, body.voipToken);
  await sendFallback(body.fallback);
  return json({ ok: true, via: 'fallback', reason: result });
});
