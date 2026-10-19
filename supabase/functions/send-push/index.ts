// Follow this setup guide to integrate the Deno runtime into your application:
// https://docs.supabase.com/guides/functions/we-twirp

// supabase/functions/send-push/index.ts
//
// Sends an OS-level push notification to a recipient's device(s) whenever a
// new `notifications` or `messages` row is inserted. Invoked by a Postgres
// trigger via `pg_net` (see supabase/migrations/015_push_notifications.sql).
//
// Request body (produced by the trigger):
//   { kind: 'notification' | 'message', recipientId, title, body, data }
//
// Resolution: looks up `profiles.push_token` for the recipient, then POSTs to
// the Expo push service (https://exp.host/--/api/v2/push/send).

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  kind: 'notification' | 'message';
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // Only accept POSTs.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify the request is from Supabase's pg_net / webhook by checking a shared
  // secret header. The trigger sets `x-send-push-secret`.
  const secret = Deno.env.get('SEND_PUSH_SECRET');
  if (secret) {
    const provided = req.headers.get('x-send-push-secret');
    if (provided !== secret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.recipientId || !payload.title) {
    return new Response(JSON.stringify({ error: 'Missing recipientId/title' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Fetch the recipient's push token(s) using the service role (bypasses RLS).
  let pushToken: string | null = null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=push_token&id=eq.${encodeURIComponent(payload.recipientId)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ push_token: string | null }>;
      pushToken = rows[0]?.push_token ?? null;
    }
  } catch (e) {
    console.error('[send-push] failed to fetch push_token', e);
  }

  if (!pushToken) {
    // No token = recipient has never registered push (or signed out). Not an error.
    return new Response(JSON.stringify({ skipped: 'no_push_token' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dispatch to Expo's push service.
  try {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: { ...(payload.data ?? {}), kind: payload.kind },
        badge: 1,
      }),
    });

    if (!expoRes.ok) {
      const errText = await expoRes.text();
      console.error('[send-push] expo error', expoRes.status, errText);
      return new Response(JSON.stringify({ error: 'expo_push_failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await expoRes.json();
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-push] dispatch exception', e);
    return new Response(JSON.stringify({ error: 'dispatch_exception' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
