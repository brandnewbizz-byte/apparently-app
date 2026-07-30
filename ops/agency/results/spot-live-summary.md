# Spot/Live Tab — Mock Data Replacement Summary

**Date:** 2026-07-30
**Status:** ✅ Complete

## What Was Done

Replaced all hardcoded mock data in the Spot/Live tab (`app/(tabs)/live/index.tsx`) with real content from the Supabase backend.

## Files Created

### 1. `backend/trpc/routes/spot/route.ts` (NEW)
tRPC route with `getFeed` query that aggregates real data from Supabase:
- **posts** table → "Live Now" and "Past Broadcasts" cards (8 posts available)
- **bundles** table → "Featured" and "Upcoming" cards (3 bundles available)
- Returns a unified `SpotCard[]` array with type discriminators: `featured`, `live`, `upcoming`, `past`
- Each card maps to the existing `Stream` interface for seamless UI integration

### 2. `backend/trpc/app-router.ts` (MODIFIED)
- Registered the new `spot` router with `getFeed` procedure

### 3. `lib/api.ts` (MODIFIED)
- Added `SpotCard` and `SpotFeedResponse` TypeScript interfaces
- Added `getSpotFeed()` function that queries Supabase directly (matches existing app patterns — all other API calls go directly to Supabase, not through tRPC)
- Aggregates posts (with user join) and bundles into the card feed
- Same logic as the backend route, but runs client-side for Expo compatibility

### 4. `app/(tabs)/live/index.tsx` (MODIFIED)
- Added import: `getSpotFeed` from `@/lib/api`
- Removed 14 mock stream entries (LIVE_STREAMS, UPCOMING_SHOWS, PAST_BROADCASTS)
- Added state: `featuredStream`, `liveStreams`, `upcomingShows`, `pastBroadcasts`
- Added `useEffect` to fetch real data on mount via `getSpotFeed()`
- Updated `onRefresh` to re-fetch data instead of just showing a spinner
- **UI components preserved** — StreamViewer, GoLiveModal, SkeletonStreamCard all unchanged
- **Layout and design preserved** — Featured, Live Now, Upcoming, Past Broadcasts sections all use the same card styles

## Data Mapping

| Spot Section | Source Table | Card Type |
|---|---|---|
| Featured | First active bundle (or first post fallback) | `featured` |
| Live Now | Recent posts (excluding featured) | `live` |
| Upcoming | Remaining active bundles | `upcoming` |
| Past Broadcasts | Older posts beyond live/featured | `past` |

## Available Data
- **8 posts** with images from local device, all by user "brandnewbizz"
- **3 bundles**: "Home cleaner" ($55), "Home cleaning" ($35), "Weekend get away" ($1200)
- **1 user**: brandnewbizz

## Verification
- ✅ TypeScript passes with no new errors (pre-existing errors are in unrelated files)
- ✅ Supabase queries confirmed working (posts join + bundles filter)
- ✅ Backend tRPC route compiles cleanly
- ✅ Frontend `getSpotFeed` function matches existing API patterns

## Fallback Behavior
- If no data exists, sections gracefully render empty (Featured is conditionally rendered)
- Card images with `file://` URLs default to Unsplash placeholders (safe for web preview)
- Error handling via `console.error` + empty arrays (no crashes)
