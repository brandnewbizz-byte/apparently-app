/**
 * Safe handling of realtime channels that share a name.
 *
 * supabase-js hands back the SAME channel object when two screens open a
 * channel with the same name (e.g. `call:<room>` for the ringing screen and
 * then the call screen). Re-subscribing that object does nothing, and when
 * the first screen closes it, it also drops the second screen's channel —
 * which is why answering a call sometimes never connected (the caller kept
 * ringing). These helpers give each screen its own channel and only ever
 * close the exact channel a screen opened.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Opts = Parameters<typeof supabase.channel>[1];

function existing(topic: string): RealtimeChannel | undefined {
  return supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
}

/** Close this channel only if it is still the live one for its name. */
export async function closeChannel(ch: RealtimeChannel | null | undefined): Promise<void> {
  if (!ch) return;
  if (!supabase.getChannels().includes(ch)) return; // someone already closed it
  try { await supabase.removeChannel(ch); } catch { /* ignore */ }
}

/** A brand-new channel for `topic`, closing any older one with that name first. */
export async function openFreshChannel(topic: string, opts?: Opts): Promise<RealtimeChannel> {
  const old = existing(topic);
  if (old) await closeChannel(old);
  return supabase.channel(topic, opts);
}

/** Subscribe and wait until joined (or give up after `ms`). Resolves true when joined. */
export function subscribed(ch: RealtimeChannel, ms = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(true); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { clearTimeout(t); resolve(false); }
    });
  });
}
