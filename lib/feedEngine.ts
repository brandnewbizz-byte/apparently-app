/**
 * How cards are picked for the Home swipe stacks (bundles, skill deals).
 *
 * Types: a bundle's type is its vibe (date night, game day, getaway… see lib/vibes.ts);
 * a skill deal's type is its category.
 *
 * Memory (per account, kept on the device and synced to the account):
 *  - grab / save → never shown in the stack again, and that type gets a boost
 *  - "Not interested" → never shown again; the reason decides what else changes:
 *      not my thing → counts as 3 passes on its type; too pricey → cards at that price
 *      or more sink; too far → cards in that place sink; not those dates → just that card
 *  - skip → hidden for a while (3 days, then 14); the third skip counts as "not interested".
 *    A price drop brings it back early.
 *
 * Showing less of what people pass on: passes on a type since the last grab/save of
 * that type (recent ones count fully, older than 2 weeks half, older than 2 months not
 * at all) → 0–2 normal · 3–5 half as often · 6–9 a quarter · 10+ only a rare check-in,
 * and only when there are plenty of other cards. One grab or save resets it.
 *
 * Starting picks: the 4 kinds of plans picked on the welcome screen get a head start
 * that fades as real grabs and skips come in.
 *
 * Order: cards are scored (new, ending soon, few spots, popular, photo, taste…), then
 * mixed so each 7 cards hold ~4 from favourite types, ~2 from types we're unsure about
 * and ~1 new or trending card, never the same seller twice in a row.
 *
 * Pace: cards come in rounds; between rounds there is a wait that depends on the
 * plan. Pro never waits.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tier } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { GOING_WITH_VIBE, type GoingWith } from '@/lib/vibes';

export type FeedKind = 'bundle' | 'skill';
export type FeedVerdict = 'skip' | 'save' | 'grab' | 'hide';
export type HideReason = 'pricey' | 'not_for_me' | 'far' | 'dates';

export interface FeedItemInfo {
  id: string;
  category?: string;
  /** Types this card belongs to, main one first (bundles: vibes; skills: category). */
  types?: string[];
  location?: string;
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

interface Mark {
  v: FeedVerdict; at: number; skips: number; price?: number; cat?: string;
  /** Main type when marked. */
  t?: string;
  /** Why, for "not interested". */
  r?: HideReason;
  loc?: string;
}
interface Round { ids: string[]; startedAt: number }
export interface FeedProfile { picks: string[]; goingWith?: GoingWith; pickedAt?: number; skippedAt?: number }
interface FeedState {
  marks: Record<string, Mark>;
  rounds: Partial<Record<FeedKind, Round>>;
  waitUntil: Partial<Record<FeedKind, number>>;
  profile?: FeedProfile;
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
const kindOf = (k: string) => k.slice(0, k.indexOf(':')) as FeedKind;
const norm = (s?: string) => (s || '').trim().toLowerCase();

/** Can this card be shown in the stack now? */
export function isEligible(m: Mark | undefined, item: FeedItemInfo, now = Date.now()): boolean {
  if (!m) return true;
  if (m.v !== 'skip') return false;
  if (m.skips >= SKIPS_UNTIL_GONE) return false;
  if (m.price != null && item.price != null && item.price < m.price) return true; // price dropped
  const away = SKIP_AWAY_MS[Math.min(m.skips, SKIP_AWAY_MS.length) - 1] ?? SKIP_AWAY_MS[SKIP_AWAY_MS.length - 1];
  return now - m.at >= away;
}

// ── What this person likes and passes on ─────────────────────────────────────
/** Recent passes count fully, older than 2 weeks half, older than 2 months not at all. */
const ageWeight = (at: number, now: number) => (now - at < 14 * DAY ? 1 : now - at < 60 * DAY ? 0.5 : 0);

function passWeight(m: Mark): number {
  if (m.v === 'skip') return m.skips;
  if (m.v !== 'hide') return 0;
  if (m.r === 'not_for_me') return 3;
  if (m.r === 'pricey' || m.r === 'far' || m.r === 'dates') return 0; // that card only (+ price/place below)
  return m.skips >= SKIPS_UNTIL_GONE ? m.skips : 2; // 3rd skip, or "not interested" without a reason
}

/** How often a type should show, from passes since the last grab/save of it. */
export function fadeFor(passes: number): number {
  if (passes < 3) return 1;
  if (passes < 6) return 0.5;
  if (passes < 10) return 0.25;
  return 0; // rare check-ins only
}

export interface Taste {
  /** −1..1 per type from grabs/saves vs passes. */
  affinity: Record<string, number>;
  /** 1 · 0.5 · 0.25 · 0 (rare) per type. */
  fade: Record<string, number>;
  /** Head start per type from the welcome picks, already faded by how much we know. */
  prior: Record<string, number>;
  /** Cards at this price or more sink ("too pricey"). */
  priceCap?: number;
  /** Places marked "too far". */
  farPlaces: Set<string>;
  /** How many cards of this kind the person has acted on. */
  interactions: number;
}

export function buildTaste(marks: Record<string, Mark>, kind: FeedKind, profile: FeedProfile | undefined, now = Date.now()): Taste {
  const pos: Record<string, number> = {};
  const neg: Record<string, number> = {};
  const lastLike: Record<string, number> = {};
  const passList: { t: string; w: number; at: number }[] = [];
  const farPlaces = new Set<string>();
  let priceCap: number | undefined;
  let interactions = 0;

  for (const [k, m] of Object.entries(marks)) {
    if (kindOf(k) !== kind) continue;
    interactions++;
    const t = m.t || m.cat;
    if (m.v === 'hide' && m.r === 'pricey' && m.price && ageWeight(m.at, now) > 0) priceCap = Math.min(priceCap ?? Infinity, m.price);
    if (m.v === 'hide' && m.r === 'far' && m.loc && ageWeight(m.at, now) > 0) farPlaces.add(norm(m.loc));
    if (!t) continue;
    if (m.v === 'grab' || m.v === 'save') {
      pos[t] = (pos[t] || 0) + (m.v === 'grab' ? 2 : 1);
      lastLike[t] = Math.max(lastLike[t] || 0, m.at);
    } else {
      const w = passWeight(m) * ageWeight(m.at, now);
      if (w > 0) { neg[t] = (neg[t] || 0) + w * 0.5; passList.push({ t, w, at: m.at }); }
    }
  }

  const passes: Record<string, number> = {};
  for (const p of passList) if (p.at > (lastLike[p.t] || 0)) passes[p.t] = (passes[p.t] || 0) + p.w;
  const fade: Record<string, number> = {};
  for (const [t, n] of Object.entries(passes)) fade[t] = fadeFor(n);

  const affinity: Record<string, number> = {};
  for (const t of new Set([...Object.keys(pos), ...Object.keys(neg)])) {
    const p = pos[t] || 0, n = neg[t] || 0;
    affinity[t] = Math.max(-1, Math.min(1, (p - n) / (p + n + 3)));
  }

  // Welcome picks: a head start that fades to a third as real behaviour comes in.
  const prior: Record<string, number> = {};
  if (kind === 'bundle' && profile?.picks?.length) {
    const strength = Math.max(0.35, 1 - interactions / 40);
    for (const v of profile.picks) prior[v] = (prior[v] || 0) + strength;
    const gw = profile.goingWith ? GOING_WITH_VIBE[profile.goingWith] : undefined;
    if (gw) prior[gw] = (prior[gw] || 0) + 0.4 * strength;
  }

  return { affinity, fade, prior, priceCap: Number.isFinite(priceCap as number) ? priceCap : undefined, farPlaces, interactions };
}

// ── Ranking ──────────────────────────────────────────────────────────────────
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10_000) / 10_000;
}

const typesOf = (item: FeedItemInfo) => (item.types?.length ? item.types : item.category ? [item.category] : ['other']);

/** How often this card's type should show (1 normal … 0 rare check-in only). */
export function fadeOf(item: FeedItemInfo, taste: Taste): number {
  return taste.fade[typesOf(item)[0]] ?? 1;
}

/** How much this person likes the card's types: best of its types, −1..~2. */
function likingOf(item: FeedItemInfo, taste: Taste): number {
  let best = -Infinity;
  for (const t of typesOf(item)) best = Math.max(best, (taste.affinity[t] || 0) + (taste.prior[t] || 0));
  return best === -Infinity ? 0 : best;
}

export function scoreItem(item: FeedItemInfo, taste: Taste, mark: Mark | undefined, now = Date.now()): number {
  let score = 0;
  const created = item.createdAt ? Date.parse(item.createdAt) : NaN;
  if (!Number.isNaN(created)) score += 3 * Math.exp(-Math.max(0, now - created) / (5 * DAY)); // new first
  if (item.expiresIn && item.expiresIn > 0 && item.expiresIn < 48 * 3600) score += 1.5;       // ending soon
  if (item.spotsLeft != null && item.spotsLeft > 0 && item.spotsLeft <= 2) score += 1;          // almost gone
  score += 1.5 * Math.min(item.grabCount || 0, 10) / 10;                                        // popular
  if (item.hasImage) score += 1;
  if ((item.description || '').trim().length >= 40) score += 0.5;
  score += 2 * likingOf(item, taste);                                                           // taste + picks
  const fade = fadeOf(item, taste);
  if (fade > 0 && fade < 1) score += 3 * Math.log2(fade);                                       // passed on a lot
  if (taste.priceCap != null && item.price != null && item.price >= taste.priceCap * 0.9) score -= 2; // "too pricey"
  if (item.location && taste.farPlaces.has(norm(item.location))) score -= 2;                    // "too far"
  if (!mark) score += 1;                                                                        // never seen
  const day = new Date(now).toISOString().slice(0, 10);
  score += 0.6 * hash01(`${item.id}|${day}`);                                                   // daily shuffle
  return score;
}

type Bucket = 'top' | 'unsure' | 'discovery';
/** Every 7 cards: ~4 favourites, ~2 unsure, ~1 new or trending. */
const MIX: Bucket[] = ['top', 'top', 'unsure', 'top', 'discovery', 'top', 'unsure'];
/** With fewer other cards than this, passed-on types fill in at the end instead of waiting for a check-in. */
const PLENTY = 14;
/** One check-in card from a much-passed type per this many cards. */
const CHECK_IN_EVERY = 30;

/**
 * Best first, mixed by type, and never the same seller twice in a row when
 * there's another choice.
 */
export function rankItems<T extends FeedItemInfo>(items: T[], marks: Record<string, Mark>, kind: FeedKind, now = Date.now(), profile?: FeedProfile): T[] {
  const taste = buildTaste(marks, kind, profile, now);
  const scored = items
    .map((it) => ({ it, s: scoreItem(it, taste, marks[key(kind, it.id)], now) }))
    .sort((a, b) => b.s - a.s);

  const buckets: Record<Bucket, T[]> = { top: [], unsure: [], discovery: [] };
  const rare: T[] = [];
  // Faded types: only their best half / quarter stays in the mix; the rest wait at the back.
  const later: T[] = [];
  const typeTotal: Record<string, number> = {};
  for (const { it } of scored) { const t = typesOf(it)[0]; typeTotal[t] = (typeTotal[t] || 0) + 1; }
  const typeKept: Record<string, number> = {};
  for (const { it } of scored) {
    const fade = fadeOf(it, taste);
    if (fade === 0) { rare.push(it); continue; }
    if (fade < 1) {
      const t = typesOf(it)[0];
      const allowed = Math.max(1, Math.ceil(typeTotal[t] * fade));
      if ((typeKept[t] || 0) >= allowed) { later.push(it); continue; }
      typeKept[t] = (typeKept[t] || 0) + 1;
      buckets.unsure.push(it); // never a "favourite" while it's being passed on
      continue;
    }
    const liking = likingOf(it, taste);
    const created = it.createdAt ? Date.parse(it.createdAt) : NaN;
    const fresh = !Number.isNaN(created) && now - created < 3 * DAY;
    const unseen = !marks[key(kind, it.id)];
    if (liking > 0.15) buckets.top.push(it);
    else if (unseen && (fresh || (it.grabCount || 0) >= 3)) buckets.discovery.push(it);
    else buckets.unsure.push(it);
  }
  const plenty = buckets.top.length + buckets.unsure.length + buckets.discovery.length >= PLENTY;

  const out: T[] = [];
  const take = (pool: T[]): T | undefined => {
    if (!pool.length) return undefined;
    const prev = out[out.length - 1];
    let idx = prev?.creatorId ? pool.findIndex((p) => p.creatorId !== prev.creatorId) : 0;
    if (idx < 0) idx = 0;
    return pool.splice(idx, 1)[0];
  };
  const fallback: Record<Bucket, Bucket[]> = { top: ['top', 'unsure', 'discovery'], unsure: ['unsure', 'discovery', 'top'], discovery: ['discovery', 'unsure', 'top'] };
  let i = 0;
  while (buckets.top.length + buckets.unsure.length + buckets.discovery.length) {
    if (plenty && rare.length && out.length % CHECK_IN_EVERY === CHECK_IN_EVERY - 1) { out.push(rare.shift()!); continue; }
    const want = MIX[i++ % MIX.length];
    for (const b of fallback[want]) { const next = take(buckets[b]); if (next) { out.push(next); break; } }
  }
  out.push(...later);
  // Not many other cards: rather than an empty stack, the passed-on types go last.
  if (!plenty) out.push(...rare);
  return out;
}

// ── Storage (one shared store per account, synced to the account) ────────────
const storageKey = (uid: string) => `apparently_feed_v1_${uid}`;
const empty = (): FeedState => ({ marks: {}, rounds: {}, waitUntil: {} });
const MAX_MARKS = 2000;
const SYNC_DELAY_MS = 3000;

function mergeStates(a: FeedState, b: FeedState): FeedState {
  const marks = { ...a.marks };
  for (const [k, m] of Object.entries(b.marks || {})) if (!marks[k] || m.at > marks[k].at) marks[k] = m;
  const waitUntil = { ...a.waitUntil };
  for (const [k, w] of Object.entries(b.waitUntil || {}) as [FeedKind, number][]) waitUntil[k] = Math.max(waitUntil[k] || 0, w || 0);
  const pa = a.profile, pb = b.profile;
  const stamp = (p?: FeedProfile) => Math.max(p?.pickedAt || 0, p?.skippedAt || 0);
  const profile = stamp(pb) > stamp(pa) ? pb : pa;
  return { marks, rounds: { ...(b.rounds || {}), ...a.rounds }, waitUntil, ...(profile ? { profile } : {}) };
}

type Listener = () => void;
class FeedStore {
  uid: string | null = null;
  state: FeedState = empty();
  loaded = false;
  /** True once the account's copy has been checked (or couldn't be). */
  synced = false;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteOff = false;

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((l) => l()); }

  async load(uid: string | null) {
    if (uid === this.uid && this.loaded) return;
    // A save queued for the previous account must never land on this one.
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null; }
    this.uid = uid;
    this.loaded = false;
    this.synced = false;
    this.state = empty();
    if (uid) {
      try {
        const raw = await AsyncStorage.getItem(storageKey(uid));
        if (raw && this.uid === uid) this.state = { ...empty(), ...JSON.parse(raw) };
      } catch { /* start fresh */ }
    }
    if (this.uid !== uid) return;
    this.loaded = true;
    this.emit();
    if (uid) this.pull(uid);
  }

  /** Bring in what this account did on other devices. */
  private async pull(uid: string) {
    try {
      const { data, error } = await supabase.from('feed_profiles').select('state').eq('user_id', uid).maybeSingle();
      if (this.uid !== uid) return;
      if (error) { this.remoteOff = true; }
      else if (data?.state && typeof data.state === 'object') {
        this.state = mergeStates(this.state, { ...empty(), ...(data.state as FeedState) });
        this.saveLocal();
      }
      if (!error) this.queueSync();
    } catch { this.remoteOff = true; }
    if (this.uid !== uid) return;
    this.synced = true;
    this.emit();
  }

  private trim() {
    const marks = Object.entries(this.state.marks);
    if (marks.length > MAX_MARKS) {
      marks.sort((a, b) => b[1].at - a[1].at);
      this.state.marks = Object.fromEntries(marks.slice(0, MAX_MARKS));
    }
  }

  private saveLocal() {
    const uid = this.uid;
    if (!uid || !this.loaded) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.uid !== uid) return;
      this.trim();
      AsyncStorage.setItem(storageKey(uid), JSON.stringify(this.state)).catch(() => {});
    }, 0);
  }

  private queueSync() {
    const uid = this.uid;
    if (!uid || !this.loaded || this.remoteOff) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(async () => {
      this.syncTimer = null;
      if (this.uid !== uid) return;
      this.trim();
      const p = this.state.profile;
      const { error } = await supabase.from('feed_profiles').upsert({
        user_id: uid, state: this.state, picks: p?.picks || [], going_with: p?.goingWith || null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) this.remoteOff = true;
    }, SYNC_DELAY_MS);
  }

  private set(next: FeedState) { this.state = next; this.emit(); this.saveLocal(); this.queueSync(); }

  mark(kind: FeedKind, item: FeedItemInfo, v: FeedVerdict, reason?: HideReason) {
    const k = key(kind, item.id);
    const prev = this.state.marks[k];
    const skips = v === 'skip' ? (prev?.v === 'skip' ? prev.skips : 0) + 1 : prev?.skips || 0;
    const m: Mark = {
      v: v === 'skip' && skips >= SKIPS_UNTIL_GONE ? 'hide' : v, at: Date.now(), skips, price: item.price,
      cat: item.category, t: typesOf(item)[0],
      ...(v === 'hide' && reason ? { r: reason } : {}),
      ...(item.location ? { loc: item.location } : {}),
    };
    this.set({ ...this.state, marks: { ...this.state.marks, [k]: m } });
  }

  setProfile(p: { picks: string[]; goingWith?: GoingWith } | 'skip') {
    const profile: FeedProfile = p === 'skip'
      ? { ...(this.state.profile || { picks: [] }), skippedAt: Date.now() }
      : { picks: p.picks, goingWith: p.goingWith, pickedAt: Date.now() };
    // New picks → start a fresh round so they show right away.
    this.set({ ...this.state, profile, rounds: p === 'skip' ? this.state.rounds : {} });
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

  /** Testing / support: forget everything for this account. */
  reset() { this.set(empty()); }
}

export const feedStore = new FeedStore();
export const feedKey = key;
export type { Mark as FeedMark, FeedState };
