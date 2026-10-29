/**
 * How cards are picked for the Home swipe stacks (bundles, skill deals).
 *
 * Memory (per account, on this device):
 *  - grab / save / "not interested"  → never shown in the stack again
 *  - skip → hidden for a while, longer each time (3 days, then 14 days);
 *    the third skip counts as "not interested". A price drop brings it back early.
 *
 * Order: everything still eligible is scored (new, ending soon, few spots left,
 * popular, has a photo, matches categories this person grabs/saves, avoids ones
 * they keep skipping), shuffled a little each day, and spread out so one seller's
 * cards don't come back to back.
 *
 * Pace: cards come in rounds; between rounds there is a wait that depends on the
 * plan. Pro never waits.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tier } from '@/lib/plans';

export type FeedKind = 'bundle' | 'skill';
export type FeedVerdict = 'skip' | 'save' | 'grab' | 'hide';

export interface FeedItemInfo {
  id: string;
  category?: string;
  creatorId?: string;
  createdAt?: string;
  price?: number;
  originalPrice?: number;
  spotsLeft?: number;
  /** Seconds until the listing ends (0/undefined = no end). */
  expiresIn?: number;
  grabCount?: number;
  hasImage?: boolean;
  description?: string;
}

interface Mark { v: FeedVerdict; at: number; skips: number; price?: number; cat?: string }
interface Round { ids: string[]; startedAt: number }
interface FeedState {
  marks: Record<string, Mark>;
  rounds: Partial<Record<FeedKind, Round>>;
  waitUntil: Partial<Record<FeedKind, number>>;
}

// ── Pace per plan ────────────────────────────────────────────────────────────
export interface FeedPace { round: number | null; waitSec: number }
export const FEED_PACE: Record<Tier, FeedPace> = {
  free: { round: 5, waitSec: 10 * 60 },
  basic: { round: 7, waitSec: 3 * 60 },
  plus: { round: 10, waitSec: 60 },
  pro: { round: null, waitSec: 0 },
};
/** Plan limits off (everyone gets everything) → the old 1-minute rhythm. */
export const PACE_WHEN_LIMITS_OFF: FeedPace = FEED_PACE.plus;

export function paceFor(plan: { tier: Tier; enforced: boolean; isAdmin?: boolean; loaded?: boolean }): FeedPace {
  if (plan.isAdmin) return FEED_PACE.pro;
  if (!plan.enforced) return PACE_WHEN_LIMITS_OFF;
  return FEED_PACE[plan.tier] || FEED_PACE.free;
}

// ── Skip memory ──────────────────────────────────────────────────────────────
const DAY = 86_400_000;
/** How long a skipped card stays away: after the 1st skip, the 2nd skip. */
export const SKIP_AWAY_MS = [3 * DAY, 14 * DAY];
/** Skips before a card is treated as "not interested". */
export const SKIPS_UNTIL_GONE = 3;

const key = (kind: FeedKind, id: string) => `${kind}:${id}`;

/** Can this card be shown in the stack now? */
export function isEligible(m: Mark | undefined, item: FeedItemInfo, now = Date.now()): boolean {
  if (!m) return true;
  if (m.v !== 'skip') return false;
  if (m.skips >= SKIPS_UNTIL_GONE) return false;
  if (m.price != null && item.price != null && item.price < m.price) return true; // price dropped
  const away = SKIP_AWAY_MS[Math.min(m.skips, SKIP_AWAY_MS.length) - 1] ?? SKIP_AWAY_MS[SKIP_AWAY_MS.length - 1];
  return now - m.at >= away;
}

// ── Ranking ──────────────────────────────────────────────────────────────────
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Per-category taste from what this person did before: >0 likes, <0 avoids. */
function tasteByCategory(marks: Record<string, Mark>): Record<string, number> {
  const pos: Record<string, number> = {};
  const neg: Record<string, number> = {};
  for (const m of Object.values(marks)) {
    if (!m.cat) continue;
    if (m.v === 'grab') pos[m.cat] = (pos[m.cat] || 0) + 2;
    else if (m.v === 'save') pos[m.cat] = (pos[m.cat] || 0) + 1;
    else if (m.v === 'hide') neg[m.cat] = (neg[m.cat] || 0) + 1.5;
    else if (m.v === 'skip') neg[m.cat] = (neg[m.cat] || 0) + 0.5 * m.skips;
  }
  const out: Record<string, number> = {};
  for (const c of new Set([...Object.keys(pos), ...Object.keys(neg)])) {
    const p = pos[c] || 0, n = neg[c] || 0;
    out[c] = Math.max(-1, Math.min(1, (p - n) / (p + n + 3)));
  }
  return out;
}

export function scoreItem(item: FeedItemInfo, taste: Record<string, number>, mark: Mark | undefined, now = Date.now()): number {
  let score = 0;
  const created = item.createdAt ? Date.parse(item.createdAt) : NaN;
  if (!Number.isNaN(created)) score += 3 * Math.exp(-Math.max(0, now - created) / (5 * DAY)); // new first
  if (item.expiresIn && item.expiresIn > 0 && item.expiresIn < 48 * 3600) score += 1.5;       // ending soon
  if (item.spotsLeft != null && item.spotsLeft > 0 && item.spotsLeft <= 2) score += 1;          // almost gone
  score += 1.5 * Math.min(item.grabCount || 0, 10) / 10;                                        // popular
  if (item.hasImage) score += 1;
  if ((item.description || '').trim().length >= 40) score += 0.5;
  if (item.category && taste[item.category] != null) score += 2 * taste[item.category];         // taste
  if (!mark) score += 1;                                                                        // never seen
  const day = new Date(now).toISOString().slice(0, 10);
  score += 0.6 * hash01(`${item.id}|${day}`);                                                   // daily shuffle
  return score;
}

/** Best first, and never the same seller twice in a row when there's another choice. */
export function rankItems<T extends FeedItemInfo>(items: T[], marks: Record<string, Mark>, kind: FeedKind, now = Date.now()): T[] {
  const taste = tasteByCategory(marks);
  const scored = items
    .map((it) => ({ it, s: scoreItem(it, taste, marks[key(kind, it.id)], now) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
  const out: T[] = [];
  const pool = [...scored];
  while (pool.length) {
    const prev = out[out.length - 1];
    let idx = prev?.creatorId ? pool.findIndex((p) => p.creatorId !== prev.creatorId) : 0;
    if (idx < 0) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// ── Storage (one shared store per account) ───────────────────────────────────
const storageKey = (uid: string) => `apparently_feed_v1_${uid}`;
const empty = (): FeedState => ({ marks: {}, rounds: {}, waitUntil: {} });
const MAX_MARKS = 3000;

type Listener = () => void;
class FeedStore {
  uid: string | null = null;
  state: FeedState = empty();
  loaded = false;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((l) => l()); }

  async load(uid: string | null) {
    if (uid === this.uid && this.loaded) return;
    // A save queued for the previous account must never land on this one.
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    this.uid = uid;
    this.loaded = false;
    this.state = empty();
    if (uid) {
      try {
        const raw = await AsyncStorage.getItem(storageKey(uid));
        if (raw && this.uid === uid) this.state = { ...empty(), ...JSON.parse(raw) };
      } catch { /* start fresh */ }
    }
    this.loaded = true;
    this.emit();
  }

  private persist() {
    const uid = this.uid;
    if (!uid || !this.loaded) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.uid !== uid) return;
      const marks = Object.entries(this.state.marks);
      if (marks.length > MAX_MARKS) {
        marks.sort((a, b) => b[1].at - a[1].at);
        this.state.marks = Object.fromEntries(marks.slice(0, MAX_MARKS));
      }
      AsyncStorage.setItem(storageKey(uid), JSON.stringify(this.state)).catch(() => {});
    }, 0);
  }

  private set(next: FeedState) { this.state = next; this.emit(); this.persist(); }

  mark(kind: FeedKind, item: FeedItemInfo, v: FeedVerdict) {
    const k = key(kind, item.id);
    const prev = this.state.marks[k];
    const skips = v === 'skip' ? (prev?.v === 'skip' ? prev.skips : 0) + 1 : prev?.skips || 0;
    const m: Mark = { v: v === 'skip' && skips >= SKIPS_UNTIL_GONE ? 'hide' : v, at: Date.now(), skips, price: item.price, cat: item.category };
    this.set({ ...this.state, marks: { ...this.state.marks, [k]: m } });
  }

  startRound(kind: FeedKind, ids: string[]) {
    this.set({ ...this.state, rounds: { ...this.state.rounds, [kind]: { ids, startedAt: Date.now() } } });
  }

  endRound(kind: FeedKind, waitSec: number) {
    const rounds = { ...this.state.rounds };
    delete rounds[kind];
    const waitUntil = { ...this.state.waitUntil };
    if (waitSec > 0) waitUntil[kind] = Date.now() + waitSec * 1000; else delete waitUntil[kind];
    this.set({ ...this.state, rounds, waitUntil });
  }

  clearWait(kind: FeedKind) {
    if (!this.state.waitUntil[kind]) return;
    const waitUntil = { ...this.state.waitUntil };
    delete waitUntil[kind];
    this.set({ ...this.state, waitUntil });
  }

  /** Testing / support: forget everything for this account on this device. */
  reset() { this.set(empty()); }
}

export const feedStore = new FeedStore();
export const feedKey = key;
export type { Mark as FeedMark, FeedState };
