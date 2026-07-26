# Fix Log — Phase 2 (High Priority)

**Date:** 2026-07-24
**Branch:** fix/phase2-high-priority

---

## Fix 1: OnboardingContext Default — Disable DEV Skip

**File:** `contexts/OnboardingContext.tsx`

**Problem:** `completed: true` hardcoded in `defaultData`, meaning all users skipped onboarding regardless of environment.

**Fix:**
- Added env toggle at top: `SKIP_ONBOARDING_IN_DEV` — true only when `NODE_ENV !== 'production'` AND `EXPO_PUBLIC_FORCE_ONBOARDING` is not set.
- Changed `completed: true` → `completed: SKIP_ONBOARDING_IN_DEV`
- Production builds: onboarding always runs (`completed: false`)
- Dev: onboarding skipped by default, but setting `EXPO_PUBLIC_FORCE_ONBOARDING=true` forces onboarding even in dev

---

## Fix 2: Connectivity / Offline Detection

**File:** `lib/connectivity.ts` (new)

**Problem:** No offline detection existed; app would silently fail on network calls.

**Fix:**
- Exports `useConnectivity()` hook — returns boolean `online` state, updates reactively
- Exports `isCurrentlyOnline()` — sync getter for non-React contexts
- Checks `https://clients3.google.com/generate_204` (HEAD request, 5s timeout)
- Polls every 30 seconds
- Listener pattern — any component using the hook re-renders on connectivity change

---

## Fix 3: Structured Logging Utility

**File:** `lib/logger.ts` (new)

**Problem:** Inconsistent `console.log` / `console.error` with no filtering or structure.

**Fix:**
- `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()` — each takes `(context, message, data?)`
- Timestamped `[ISO] [LEVEL] [CONTEXT]` prefix on every log
- In dev (`__DEV__`): all levels logged (debug+)
- In production: only warn and error logged
- Passes optional data object to native console methods

---

## Fix 4: SwapContext Realtime Reconnection

**File:** `contexts/SwapContext.tsx`

**Problem:** Supabase realtime subscription had no reconnection logic. If the WebSocket dropped (background, network change, etc.), the channel stayed dead silently.

**Fix:**
- Extracted subscription setup into `subscribeToRealtime()` callback (wrapped in `useCallback`)
- Calls `supabase.removeAllChannels()` before creating new channel — prevents duplicate subscriptions
- Existing cleanup (`removeChannel` on unmount) preserved and sets ref to `null`
- Added `AppState` listener: when app returns to `'active'` state, calls `subscribeToRealtime()` to re-establish the realtime channel
- Both useEffects have `subscribeToRealtime` as dependency to stay in sync

---

## Files Changed

| File | Action |
|------|--------|
| `contexts/OnboardingContext.tsx` | Modified (env toggle + default fix) |
| `lib/connectivity.ts` | Created |
| `lib/logger.ts` | Created |
| `contexts/SwapContext.tsx` | Modified (reconnection + AppState listener) |

## Build Status

Not run per task instructions.
