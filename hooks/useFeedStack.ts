import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  feedKey, feedStore, isEligible, paceFor, rankItems,
  type FeedItemInfo, type FeedKind, type FeedPace, type FeedVerdict,
} from '@/lib/feedEngine';

export type FeedStackState = 'loading' | 'cards' | 'wait' | 'empty';

export interface FeedStack<T> {
  state: FeedStackState;
  current?: T;
  next?: T;
  /** Cards in this round (for the progress dots); empty for Pro. */
  round: T[];
  done: number;
  /** Seconds left before the next round. */
  waitLeft: number;
  pace: FeedPace;
  record: (item: T, verdict: FeedVerdict) => void;
}

/**
 * One Home swipe stack: remembers what this person did with each card, ranks
 * the rest, and paces rounds by plan (see lib/feedEngine.ts).
 */
export function useFeedStack<T extends { id: string }>(kind: FeedKind, items: T[], describe: (t: T) => FeedItemInfo): FeedStack<T> {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const pace = paceFor(plan);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => feedStore.subscribe(rerender), []);
  useEffect(() => { feedStore.load(user?.id || null); }, [user?.id]);

  const st = feedStore.state;
  // Signed-out / not-yet-known account: wait, so nothing is written under the wrong key.
  const loaded = !!user?.id && feedStore.loaded && feedStore.uid === user.id;
  const marks = st.marks;
  const round = st.rounds[kind];
  const waitUntil = st.waitUntil[kind] || 0;

  const infos = useMemo(() => {
    const m = new Map<string, FeedItemInfo>();
    for (const it of items) m.set(it.id, describe(it));
    return m;
    // describe is a pure mapper supplied inline by the caller
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligible = useMemo(() => {
    const list = items.filter((it) => isEligible(marks[feedKey(kind, it.id)], infos.get(it.id)!, now));
    const ranked = rankItems(list.map((it) => infos.get(it.id)!), marks, kind, now);
    const byId = new Map(items.map((it) => [it.id, it] as const));
    return ranked.map((r) => byId.get(r.id)!).filter(Boolean);
  }, [items, infos, marks, kind, now]);

  const eligibleIds = useMemo(() => new Set(eligible.map((e) => e.id)), [eligible]);
  const remaining = useMemo(() => (round ? round.ids.filter((id) => eligibleIds.has(id)) : []), [round, eligibleIds]);
  const waitingMs = waitUntil - now;
  const waiting = pace.round != null && waitingMs > 0;

  // Keep rounds and waits in step with the plan and what's left.
  useEffect(() => {
    if (!loaded) return;
    if (pace.round == null) {
      if (round) feedStore.endRound(kind, 0);
      if (waitUntil) feedStore.clearWait(kind);
      return;
    }
    if (waitUntil && waitingMs > pace.waitSec * 1000) { // upgraded mid-wait → shorter wait
      feedStore.endRound(kind, pace.waitSec);
      return;
    }
    if (waitUntil && waitingMs <= 0) { feedStore.clearWait(kind); return; }
    if (waiting) return;
    if (round) {
      if (remaining.length === 0) {
        const actedThisRound = round.ids.some((id) => (marks[feedKey(kind, id)]?.at || 0) >= round.startedAt);
        feedStore.endRound(kind, actedThisRound ? pace.waitSec : 0);
      }
      return;
    }
    if (eligible.length > 0) feedStore.startRound(kind, eligible.slice(0, pace.round).map((e) => e.id));
  }, [loaded, pace.round, pace.waitSec, round, remaining.length, eligible, waitUntil, waitingMs, waiting, marks, kind]);

  // Tick once a second while waiting.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const record = useCallback((item: T, verdict: FeedVerdict) => {
    feedStore.mark(kind, describe(item), verdict);
    setNow(Date.now());
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return { state: 'loading', round: [], done: 0, waitLeft: 0, pace, record };

  if (pace.round == null) {
    return {
      state: eligible.length ? 'cards' : 'empty',
      current: eligible[0], next: eligible[1], round: [], done: 0, waitLeft: 0, pace, record,
    };
  }

  if (waiting) return { state: 'wait', round: [], done: 0, waitLeft: Math.min(pace.waitSec, Math.ceil(waitingMs / 1000)), pace, record };

  const byId = new Map(items.map((it) => [it.id, it] as const));
  const roundItems = round ? round.ids.map((id) => byId.get(id)).filter(Boolean) as T[] : [];
  const ordered = remaining.map((id) => byId.get(id)!).filter(Boolean);
  if (!round || ordered.length === 0) {
    return { state: eligible.length ? 'loading' : 'empty', round: [], done: 0, waitLeft: 0, pace, record };
  }
  return {
    state: 'cards', current: ordered[0], next: ordered[1],
    round: roundItems, done: roundItems.length - ordered.length, waitLeft: 0, pace, record,
  };
}
