/**
 * Double-tap a button on the bottom bar to refresh that page.
 * The tab bar (app/(tabs)/_layout.tsx) spots the double tap; each page
 * listens with useTabDoubleTap('<tab name>', refresh).
 */
import { useEffect, useRef } from 'react';

type Fn = () => void;
const subs = new Map<string, Set<Fn>>();

export function emitTabDoubleTap(tab: string) {
  subs.get(tab)?.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

export function useTabDoubleTap(tab: string, fn: Fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const call = () => ref.current();
    let set = subs.get(tab);
    if (!set) { set = new Set(); subs.set(tab, set); }
    set.add(call);
    return () => { set?.delete(call); };
  }, [tab]);
}

/** Two taps on the same tab within this long count as a double tap. */
const DOUBLE_TAP_MS = 350;
let last = { tab: '', at: 0 };

/** Called by the tab bar on every tab press. */
export function noteTabPress(tab: string) {
  const now = Date.now();
  if (last.tab === tab && now - last.at < DOUBLE_TAP_MS) {
    last = { tab: '', at: 0 };
    emitTabDoubleTap(tab);
  } else {
    last = { tab, at: now };
  }
}
