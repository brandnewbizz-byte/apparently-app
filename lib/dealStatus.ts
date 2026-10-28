/**
 * Bundles and skill deals use different status words in the app and in the
 * database. The database only accepts:
 *   bundles.status      → draft | active | paused
 *   skill_deals.status  → active | paused | deleted
 * Writing the app's words ('available', 'grabbed') was silently rejected, so
 * new skills were never saved and paused/full cards never updated.
 *
 * App meaning:
 *   available → live on Home
 *   draft     → paused by the owner (hidden from Home)
 *   grabbed   → all spots taken (hidden from Home)
 */
export type AppDealStatus = 'available' | 'draft' | 'grabbed' | 'fulfilled' | 'active' | 'published';

export function toDbDealStatus(status: string | undefined): 'active' | 'paused' {
  return status === 'available' || status === 'active' || status === 'published' ? 'active' : 'paused';
}

export function fromDbDealStatus(db: string | null | undefined, grabs: number, capacity: number): 'available' | 'draft' | 'grabbed' {
  if (capacity > 0 && grabs >= capacity) return 'grabbed';
  if (db === 'paused' || db === 'draft' || db === 'deleted') return 'draft';
  return 'available';
}

/** Should this card be offered to other people on Home? */
export const isDealLive = (status: string | undefined) => status === 'available' || status === 'active' || status === 'published';
