import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Private notes on a listing ("Notes for yourself" in the builders). They live in
 * their own owner-only table because bundles and skill deals are public rows.
 */
export type ListingKind = 'bundle' | 'skill_deal';

export async function loadListingNotes(listingId: string): Promise<string> {
  const { data, error } = await supabase.from('listing_notes').select('notes').eq('listing_id', listingId).maybeSingle();
  if (error) { logger.warn('ListingNotes', 'load failed', { message: error.message }); return ''; }
  return (data as { notes?: string } | null)?.notes || '';
}

export async function saveListingNotes(listingId: string, kind: ListingKind, notes: string): Promise<void> {
  const text = notes.trim().slice(0, 2000);
  const { error } = text
    ? await supabase.from('listing_notes').upsert({ listing_id: listingId, kind, notes: text, updated_at: new Date().toISOString() }, { onConflict: 'listing_id' })
    : await supabase.from('listing_notes').delete().eq('listing_id', listingId);
  if (error) logger.warn('ListingNotes', 'save failed', { message: error.message });
}

/** Loads a listing's notes once; `loaded` stays false until the request finishes. */
export function useListingNotes(listingId?: string) {
  const [state, setState] = useState<{ id?: string; notes: string; loaded: boolean }>({ notes: '', loaded: !listingId });
  useEffect(() => {
    if (!listingId) return;
    let alive = true;
    loadListingNotes(listingId).then((notes) => { if (alive) setState({ id: listingId, notes, loaded: true }); });
    return () => { alive = false; };
  }, [listingId]);
  return listingId && state.id !== listingId ? { notes: '', loaded: false } : state;
}
