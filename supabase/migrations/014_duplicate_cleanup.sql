-- ============================================================================
-- 014_duplicate_cleanup.sql
-- FIX PART 4 — Drop the dead legacy "gig marketplace" schema cluster.
--
-- Rationale: the app evolved through multiple data-model iterations, leaving
-- behind a self-contained cluster of empty tables from an older gig/proposal/
-- payment model that no code references. The LIVE tables that superseded them:
--
--   comments      -> post_comments       (0 rows, 0 code refs)
--   social_posts  -> posts               (0 rows, 0 code refs)
--   reviews       -> user_reviews        (0 rows, 0 code refs)
--   requests      -> job_requests / service_requests  (0 rows, 0 code refs)
--   gigs          -> listings            (0 rows, 0 code refs)
--   offers        -> (superseded)        (0 rows, 0 code refs)
--   proposals     -> (superseded)        (0 rows, 0 code refs)
--   payments      -> (superseded)        (0 rows, 0 code refs)
--   analytics_events -> (superseded)     (0 rows, 0 code refs)
--
-- Verified before drop (2026-09-28, via live DB inspection):
--   * All 9 tables are EMPTY (0 rows) — no data migration required.
--   * Zero code references: grep across app/ contexts/ components/ lib/ hooks/
--     backend/ for `.from('comments'|'social_posts'|'reviews'|'requests'|'gigs'
--     |'offers'|'proposals'|'payments'|'analytics_events')` returned NOTHING.
--   * No LIVE table has a foreign key pointing INTO this cluster. All FKs are
--     either outgoing (cluster -> auth.users/profiles) or internal to the
--     cluster (proposals/payments/analytics_events -> gigs; offers/reviews
--     -> requests).
--   * No triggers on any cluster table.
--   * Only dead objects reference the cluster: VIEW `my_active_gigs` (-> gigs)
--     and FUNCTIONS `sync_plan_to_request` / `on_plan_submit` (-> requests/gigs),
--     both confirmed NOT wired to any trigger.
--   * RLS policies exist on most cluster tables but are dropped with the tables.
--
-- ROLLBACK: full schema-only DDL snapshot saved to
--   /tmp/part4_rollback/dead_cluster_rollback.sql  (340 lines, generated from
--   live pg_catalog/information_schema). Tables were empty so no data loss is
--   possible; re-run the rollback DDL to recreate the empty shells.
-- ============================================================================

begin;

-- 1. Drop the dead view that references `gigs`
drop view if exists public.my_active_gigs;

-- 2. Drop dead trigger functions (verified not wired to any trigger)
drop function if exists public.sync_plan_to_request() cascade;
drop function if exists public.on_plan_submit() cascade;

-- 3. Drop the dead cluster. Dependency order: child tables (which hold FKs
--    into gigs/requests) first, then the referenced tables, then the rest.
drop table if exists public.analytics_events cascade;
drop table if exists public.payments cascade;
drop table if exists public.proposals cascade;
drop table if exists public.offers cascade;
drop table if exists public.reviews cascade;
drop table if exists public.gigs cascade;
drop table if exists public.requests cascade;
drop table if exists public.comments cascade;
drop table if exists public.social_posts cascade;

commit;
