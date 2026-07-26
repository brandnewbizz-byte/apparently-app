# Phase 1 Critical Fix Log — 2026-07-24

## Fix 1: AuthContext.tsx — Real Auth Support (Production)

**File:** `contexts/AuthContext.tsx`

**What was wrong:** The app had hardcoded dev auth that always returned `isAuthenticated: true` with a dummy user, bypassing all real authentication. Production builds had no way to use Supabase auth.

**Changes made:**
- Added `IS_DEV` constant (`process.env.NODE_ENV !== 'production' && !process.env.EXPO_PUBLIC_FORCE_REAL_AUTH`) and `DEV_USER_ID` at the top
- Split the old `defaultState` into `DEV_STATE` (dev user, authenticated) and `PROD_STATE` (null session, not authenticated)
- State initialization is conditional: dev mode gets `DEV_STATE` + `isLoading: false`, production gets `PROD_STATE` + `isLoading: true`
- Added `useEffect` on mount that:
  - In dev mode: skips everything, sets `isLoading = false` (unchanged behavior)
  - In production: calls `supabase.auth.getSession()` to check for an existing session, then subscribes to `onAuthStateChange` for live updates
  - All references to the old `defaultState` replaced with conditional `IS_DEV ? DEV_STATE : PROD_STATE`
- Modified `signOut()` — only calls `supabase.auth.signOut()` when `!IS_DEV`, and resets state to the appropriate mode default
- `setSessionState()` fallback (no session path) now uses conditional state instead of always defaulting to dev

**Backward compatibility:** All dev mode behavior is preserved. Setting `EXPO_PUBLIC_FORCE_REAL_AUTH=true` forces production auth even in dev builds.

---

## Fix 2: ErrorBoundary.tsx — Robust Crash Recovery

**Files:**
- **Created:** `components/ErrorBoundary.tsx`
- **Modified:** `app/_layout.tsx`

**What was wrong:** No generic error boundary existed at the app root level. A crash in any provider would bring down the entire app with no recovery path.

**Changes made:**
- Created `components/ErrorBoundary.tsx` — a class-based React error boundary with:
  - `getDerivedStateFromError` for capturing thrown errors
  - `componentDidCatch` for logging (`console.error` with component stack)
  - `onError` callback prop for custom error reporting
  - `fallback` prop to override the default error UI
  - Default fallback UI with "⚠️ Something went wrong", error message, and "Try Again" button
  - `handleRetry` resets error state and re-renders children
- Wrapped `ErrorBoundary` as the outermost wrapper inside `ProviderErrorBoundary` in `app/_layout.tsx`, just inside `<trpc.Provider>`. This catches crashes from any provider or component in the tree.

**Note:** A `ProviderErrorBoundary` already existed in `_layout.tsx` wrapping everything. The new `ErrorBoundary` sits inside it as an additional layer, and `AppErrorBoundary` (in `components/AppErrorBoundary.tsx`) wraps just the `RootLayoutNavWithTheme` component. These three boundaries provide defense-in-depth.

---

## Fix 3: BundleContext.tsx — AsyncStorage Persistence

**File:** `contexts/BundleContext.tsx`

**What was wrong:** Bundles (created, grabbed, deleted) were stored only in React state. All changes were lost on app restart.

**Changes made:**
- Added imports for `useEffect` and `AsyncStorage`
- Added `STORAGE_KEY = 'apparently_bundles_v1'`
- Added `isLoaded` state flag to prevent saving before initial load completes
- On mount: loads bundles from AsyncStorage, then merges with `SEED_BUNDLES` by ID (stored bundles take precedence; seed bundles fill in any gaps)
- Added `saveBundles()` helper that writes the full bundle array to AsyncStorage
- Wired `saveBundles` into all three mutators (`createBundle`, `grabBundle`, `deleteBundle`) — saves after each mutation once `isLoaded` is true
- Seed data initialization is untouched — it serves as the baseline, and persisted data layers on top

---

## Fix 4: ServiceRequestContext.tsx — AsyncStorage Persistence

**File:** `contexts/ServiceRequestContext.tsx`

**What was wrong:** Service requests were stored only in React state. All changes were lost on app restart.

**Changes made:**
- Added imports for `useEffect` and `AsyncStorage`
- Added `STORAGE_KEY = 'apparently_service_requests_v1'`
- Added `isLoaded` state flag to prevent saving before initial load completes
- On mount: loads requests from AsyncStorage, merges with `SEED_REQUESTS` by ID (stored requests take precedence; seed requests fill in any gaps)
- Added `saveRequests()` helper that writes the full request array to AsyncStorage
- Wired `saveBundles` into all three mutators (`createRequest`, `updateRequestStatus`, `deleteRequest`) — saves after each mutation once `isLoaded` is true
- Seed data (`SEED_REQUESTS`) initialization is untouched

---

## Summary

| # | File | Action | Impact |
|---|------|--------|--------|
| 1 | `contexts/AuthContext.tsx` | Modified | Production auth with Supabase session management; dev mode preserved |
| 2 | `components/ErrorBoundary.tsx` | Created | New reusable error boundary component |
| 2 | `app/_layout.tsx` | Modified | Wrapped root with ErrorBoundary for crash recovery |
| 3 | `contexts/BundleContext.tsx` | Modified | Bundle data survives app restarts |
| 4 | `contexts/ServiceRequestContext.tsx` | Modified | Service request data survives app restarts |

**No build commands were run.** All changes are code-only and ready for review/testing.
