# Report & Hide — Wired Up

## Done
- ✅ Created `backend/trpc/routes/reports/route.ts` with `report` and `hide` mutations
- ✅ Updated `backend/trpc/app-router.ts` with reports router
- ✅ Wired PostCard.tsx handlers to persist to Supabase
  - `handleHidePost()` → inserts into `hidden_posts`
  - `confirmReport()` → inserts into `reports`
  - Graceful fallback if tables don't exist (silent console log)
- ✅ Backend restarted with new routes

## Blocked: Missing Tables
`reports` and `hidden_posts` tables don't exist yet — need Direct Connections enabled.
SQL is ready in `pending-schema-updates.sql`.

## How to test once tables exist
1. Run `pending-schema-updates.sql` in Supabase SQL Editor
2. Tap "..." on any post → "Report Post" → pick a reason
3. Tap "..." → "Hide Post" 
4. Data should persist to Supabase
