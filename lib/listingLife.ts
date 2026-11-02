/**
 * Bundles and skill deals stay on Home for 3 days. On the last day (or after)
 * the owner can re-share: the same listing is brought back as new, with no
 * duplicate created — its "posted" time simply moves to now.
 */
import { supabase } from '@/lib/supabase';

export const LISTING_LIFE_MS = 3 * 86_400_000;

/** When a listing posted (or re-shared) at `createdAt` leaves Home, in ms. */
export function listingLiveUntil(createdAt?: string | null): number | undefined {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) ? t + LISTING_LIFE_MS : undefined;
}

export function listingExpired(createdAt?: string | null, now = Date.now()): boolean {
  const until = listingLiveUntil(createdAt);
  return until != null && until <= now;
}

/** "2 days left", "5 h left", "Off Home" … */
export function listingTimeLeft(createdAt?: string | null, now = Date.now()): string {
  const until = listingLiveUntil(createdAt);
  if (until == null) return '';
  const ms = until - now;
  if (ms <= 0) return 'Off Home · re-share to bring it back';
  const h = Math.ceil(ms / 3_600_000);
  return h > 24 ? `${Math.ceil(h / 24)} days left on Home` : `${h} h left on Home`;
}

/** Last day (or expired): time to nudge the owner to re-share. */
export function listingNeedsReshare(createdAt?: string | null, now = Date.now()): boolean {
  const until = listingLiveUntil(createdAt);
  return until != null && until - now <= 86_400_000;
}

/** Bring a bundle / skill deal back to Home as new (same listing, no duplicate). */
export async function reshareListing(kind: 'bundle' | 'skill', id: string): Promise<void> {
  const table = kind === 'bundle' ? 'bundles' : 'skill_deals';
  const { data, error } = await supabase
    .from(table)
    .update({ created_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Only the owner can re-share this.');
}
