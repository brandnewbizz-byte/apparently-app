// supabase/functions/voip-push/index.ts
//
// Rings an iPhone like WhatsApp: sends an Apple VoIP push for a call
// notification, which wakes the Apparently app (even closed or locked) and
// shows the system incoming-call screen (CallKit).
//
// Called by public.dispatch_push (migration 036) with { notificationId }.
// It only acts on a fresh, unanswered call notification, once per call, so it
// can't be used to send anything else.
//
// Needs these secrets (Supabase → Edge Functions → Secrets):
//   APNS_KEY_P8    the text of the Apple Push Notifications key (.p8 file)
//   APNS_KEY_ID    that key's Key ID (10 characters)
//   APPLE_TEAM_ID  the Apple Developer Team ID (10 characters)
// Without them (or if Apple refuses), it sends the normal call notification.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUNDLE_ID = Deno.env.get('IOS_BUNDLE_ID') || 'app.rork.apparently-app-real-app';
const RING_MS = 45_000;
const CALL_TYPES = ['call', 'call_request'];

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

// ── Apple provider token (ES256 JWT), reused for 40 minutes ──
let cachedJwt: { token: string; at: number } | null = null;

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function appleJwt(): Promise<string | null> {
  const p8 = Deno.env.get('APNS_KEY_P8');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  if (!p8 || !keyId || !teamId) return null;
  if (cachedJwt && Date.now() - cachedJwt.at < 40 * 60_000) return cachedJwt.token;
  const pem = p8.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId.trim() }));
  const claims = b64url(JSON.stringify({ iss: teamId.trim(), iat: Math.floor(Date.now() / 1000) }));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`)));
  const token = `${header}.${claims}.${b64url(sig)}`;
  cachedJwt = { token, at: Date.now() };
  return token;
}

async function sendVoip(deviceToken: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; reason?: string }> {
  const jwt = await appleJwt();
  if (!jwt) return { ok: false, status: 0, reason: 'NoAppleKey' };
  const send = async (host: string) => {
    const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': `${BUNDLE_ID}.voip`,
        'apns-push-type': 'voip',
        'apns-priority': '10',
        'apns-expiration': '0',
      },
      body: JSON.stringify(payload),
    });
    let reason: string | undefined;
    if (!res.ok) { try { reason = (await res.json())?.reason; } catch { /* empty */ } }
    else await res.body?.cancel();
    return { ok: res.ok, status: res.status, reason };
  };
  let r = await send('api.push.apple.com');
  // Development builds have sandbox tokens.
  if (!r.ok && r.reason === 'BadDeviceToken') {
    const s = await send('api.sandbox.push.apple.com');
    if (s.ok) r = s;
  }
  if (r.reason === 'ExpiredProviderToken' || r.reason === 'InvalidProviderToken') cachedJwt = null;
  return r;
}

async function sendExpoFallback(n: any, pushToken: string | null) {
  if (!pushToken) return;
  const d = n.data || {};
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: pushToken,
      title: n.title || 'Incoming call',
      body: n.body || '',
      data: { ...d, kind: 'call', type: n.type, notificationId: n.id, actor_id: n.actor_id, createdAt: n.created_at },
      priority: 'high',
      sound: 'ringtone.wav',
      channelId: 'incoming_calls',
      categoryId: 'incoming_call',
      ttl: 45,
    }),
  }).then((r) => r.body?.cancel(), () => {});
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let notificationId = '';
  try { notificationId = String((await req.json())?.notificationId || ''); } catch { /* empty */ }
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) return json({ error: 'notificationId required' }, 400);

  const { data: n } = await admin.from('notifications').select('*').eq('id', notificationId).maybeSingle();
  if (!n || !CALL_TYPES.includes(n.type) || n.read) return json({ skipped: 'not a ringing call' });
  if (Date.now() - new Date(n.created_at).getTime() > RING_MS) return json({ skipped: 'too old' });

  // Once per call.
  const { error: dup } = await admin.from('voip_push_log').insert({ notification_id: n.id });
  if (dup) return json({ skipped: 'already sent' });

  const { data: p } = await admin.from('profiles').select('voip_token, push_token').eq('id', n.user_id).maybeSingle();
  const d = n.data || {};
  const payload = {
    uuid: crypto.randomUUID(),
    // What the phone shows and needs to join the call.
    callerId: d.caller_id || n.actor_id || '',
    callerName: d.caller_name || n.actor_name || 'Someone',
    video: !!d.video,
    roomId: d.room_id || '',
    room_id: d.room_id || '',
    caller_id: d.caller_id || n.actor_id || '',
    caller_name: d.caller_name || n.actor_name || 'Someone',
    caller_avatar: d.caller_avatar || n.actor_avatar || '',
    notificationId: n.id,
    createdAt: n.created_at,
  };

  let result = 'no voip token';
  if (p?.voip_token) {
    const r = await sendVoip(p.voip_token, payload);
    result = r.ok ? 'voip ok' : `voip ${r.status} ${r.reason || ''}`.trim();
    if (r.ok) {
      await admin.from('voip_push_log').update({ result }).eq('notification_id', n.id);
      return json({ sent: 'voip' });
    }
    // The phone no longer has this app (or the token is wrong): stop using it.
    if (r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered') {
      await admin.from('profiles').update({ voip_token: null, voip_token_updated_at: null }).eq('id', n.user_id);
    }
  }
  await sendExpoFallback(n, p?.push_token || null);
  await admin.from('voip_push_log').update({ result: `${result} → fallback` }).eq('notification_id', n.id);
  return json({ sent: 'fallback', result });
});
