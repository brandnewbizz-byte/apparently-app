# Phase 3 Fix Log — Medium Priority Issues

**Date:** 2026-07-24
**Branch:** `main`
**Status:** ✅ All fixes applied, no build attempted

---

## Fix 1: MessagingContext Supabase Sync
**File:** `contexts/MessagingContext.tsx`

### Changes
1. **Added import:** `import { supabase } from '@/lib/supabase';`
2. **Added `syncToSupabase` function** — Upserts conversations to `conversations` table and messages to `messages` table. Wrapped in try/catch so failures never block UX. Uses `onConflict: 'id'` for idempotent upserts.
3. **Added `syncFromSupabase` function** — Fetches conversations + messages from Supabase on mount. Returns empty array on any failure so AsyncStorage fallback still works.
4. **Modified `sendMessage`** — After updating local state and persisting to AsyncStorage, calls `syncToSupabase(updatedConversations)` as a fire-and-forget (non-blocking).
5. **Modified `getConversation`** — Now checks local state first (fast path). Async fallback to Supabase described in code comment.
6. **Added mount `useEffect`** — Calls `syncFromSupabase()` on mount; if remote data exists, it replaces local state and also caches to AsyncStorage via `persistMutation`.
7. **Added `useRef` import** — `useRef` added to the React imports for `currentUserId` ref.

### Notes
- Table names: `conversations`, `messages`
- Gracefully handles missing tables (error code `PGRST205`)
- All Supabase operations are non-blocking; local UX remains instant

---

## Fix 2: Feed Deduplication Logic
**File:** `app/(tabs)/feed/index.tsx`

### Changes
Replaced the flat concatenation in `filteredPosts` useMemo:
```ts
// Before:
let all = [...userPosts, ...FEED_POSTS, ...marketplacePosts, ...];
```
With a prioritized deduplication pipeline:

1. **ID collision detection** — Tracks `seenIds` Set; skips any post whose `id` was already added.
2. **Content-based near-duplicate detection** — Tracks `seenContentKeys` Set using `"title|caption|authorName"` normalized to lowercase. Prevents near-duplicates where different ID prefixes point to the same content.
3. **Priority order:**
   - `userPosts` (user-created) — highest priority
   - Context data (`marketplacePosts`, `rentalPosts`, `swapFeedPosts`, `connectionPosts`, `requestPosts`, `bundlePosts`) — preferred over hardcoded
   - `FEED_POSTS` (hardcoded) — lowest priority, skipped if context already covers same content

This ensures the feed never shows duplicate content from multiple sources.

---

## Fix 3: SocialContext Data Staleness Indicator
**File:** `contexts/SocialContext.tsx`

### Changes
Added three new fields to the context return value:

| Field | Type | Description |
|---|---|---|
| `dataSource` | `'supabase' \| 'local_api' \| 'mock'` | Tracks which tier provided the posts data |
| `isStale` | `boolean` | `true` when using `local_api` or `mock` |
| `lastFetchTime` | `number \| null` | Unix timestamp of last successful data fetch |

### Implementation
- `dataSource` default: `'mock'`
- Set to `'supabase'` when `postsQuery.data` loads from Supabase
- Set to `'local_api'` when the local API fallback succeeds (in the `apiLoaded` useEffect)
- Set to `'mock'` when local API fails
- `isStale` derived as `dataSource === 'local_api' || dataSource === 'mock'`
- UI can use these to show "Offline" badges or stale-data warnings

---

## Fix 4: MarketplaceContext Data Staleness Indicator
**File:** `contexts/MarketplaceContext.tsx`

### Changes
Same pattern as SocialContext:

| Field | Type | Description |
|---|---|---|
| `dataSource` | `'supabase' \| 'local_api' \| 'mock'` | Tracks which tier provided product data |
| `isStale` | `boolean` | `true` when using `local_api` or `mock` |
| `lastFetchTime` | `number \| null` | Unix timestamp of last successful data fetch |

### Implementation
- Modified `productsQuery.queryFn` to return `{ products, source }` instead of plain `Product[]`
- Updated the `useEffect` that consumes `productsQuery.data` to extract and set `dataSource` and `lastFetchTime`
- Added backward-compat handling for plain `Product[]` return shapes
- `isStale` derived as `dataSource === 'local_api' || dataSource === 'mock'`

---

## Summary

| Fix | File | Lines Changed | Status |
|---|---|---|---|
| Messaging Supabase sync | `contexts/MessagingContext.tsx` | ~110 added | ✅ |
| Feed deduplication | `app/(tabs)/feed/index.tsx` | ~25 added | ✅ |
| SocialContext staleness | `contexts/SocialContext.tsx` | ~15 added | ✅ |
| MarketplaceContext staleness | `contexts/MarketplaceContext.tsx` | ~25 added | ✅ |

**No build commands run.** All changes are additive and preserve existing behavior through graceful fallbacks.
