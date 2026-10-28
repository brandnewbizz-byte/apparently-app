/**
 * Storage space per plan (Free 1 GB, Basic 10 GB, Plus 50 GB, Pro 200 GB).
 * Checked before every upload; when it's full the upgrade screen opens and
 * the upload stops with a StorageFullError.
 */
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export class StorageFullError extends Error {
  constructor() { super('Your storage is full. Upgrade your plan for more space.'); this.name = 'StorageFullError'; }
}

let lastPaywall = 0;

export async function ensureUploadSpace(bytes: number): Promise<void> {
  if (!bytes || bytes <= 0) return;
  const { data, error } = await supabase.rpc('can_upload', { p_bytes: Math.round(bytes) });
  if (error) return; // never block uploads on a check failure
  const r = data as { ok?: boolean; reason?: string } | null;
  if (r && r.ok === false && r.reason !== 'not_signed_in') {
    if (Date.now() - lastPaywall > 1500) {
      lastPaywall = Date.now();
      router.push({ pathname: '/paywall' as any, params: { reason: 'storage' } });
    }
    throw new StorageFullError();
  }
}
