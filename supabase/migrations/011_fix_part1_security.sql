-- ============================================================================
-- 011_fix_part1_security.sql
-- FIX PART 1 — CRITICAL SECURITY REPAIRS (authorized 2026-09-28)
--
-- Scope (no identity migration, no table deletes, no dead-code cleanup):
--   1. Enable RLS + ownership policies on 17 RLS-OFF tables.
--   2. Protect profile PII via column-level SELECT grants + SECURITY DEFINER RPCs.
--   3. Tighten listings / job_requests marketplace mutation policies.
--   4. Restrict notifications INSERT to the acting user (actor_id).
--   5. Require authenticated author_id for post_comments INSERT.
--   6. (storage bucket handled separately — see 011b_storage / storage REST step)
--
-- Idempotent: every DROP uses IF EXISTS; every CREATE is REPLACE-style via
-- DROP ... IF EXISTS then CREATE. Safe to re-run.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. RLS-OFF TABLES — enable RLS + ownership policies
--    TEXT owner-id columns use auth.uid()::text; UUID columns use auth.uid().
-- ---------------------------------------------------------------------------

-- 1a. conversations (participant_one uuid, participant_two uuid)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations select participant" ON public.conversations;
CREATE POLICY "conversations select participant" ON public.conversations
  FOR SELECT USING (auth.uid() IN (participant_one, participant_two));
DROP POLICY IF EXISTS "conversations insert participant" ON public.conversations;
CREATE POLICY "conversations insert participant" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IN (participant_one, participant_two));
DROP POLICY IF EXISTS "conversations update participant" ON public.conversations;
CREATE POLICY "conversations update participant" ON public.conversations
  FOR UPDATE USING (auth.uid() IN (participant_one, participant_two));
DROP POLICY IF EXISTS "conversations delete participant" ON public.conversations;
CREATE POLICY "conversations delete participant" ON public.conversations
  FOR DELETE USING (auth.uid() IN (participant_one, participant_two));

-- 1b. payments (user_id uuid) — admin-facing financial records
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments select own or admin" ON public.payments;
CREATE POLICY "payments select own or admin" ON public.payments
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "payments insert own" ON public.payments;
CREATE POLICY "payments insert own" ON public.payments
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "payments update admin" ON public.payments;
CREATE POLICY "payments update admin" ON public.payments
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "payments delete admin" ON public.payments;
CREATE POLICY "payments delete admin" ON public.payments
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 1c. reports (reported_by text, post_id text, id bigint) — admin moderation
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports select admin" ON public.reports;
CREATE POLICY "reports select admin" ON public.reports
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "reports insert self" ON public.reports;
CREATE POLICY "reports insert self" ON public.reports
  FOR INSERT WITH CHECK (reported_by = auth.uid()::text);
DROP POLICY IF EXISTS "reports update admin" ON public.reports;
CREATE POLICY "reports update admin" ON public.reports
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "reports delete admin" ON public.reports;
CREATE POLICY "reports delete admin" ON public.reports
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 1d. hidden_posts (user_id text, post_id text)
ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hidden_posts select own" ON public.hidden_posts;
CREATE POLICY "hidden_posts select own" ON public.hidden_posts
  FOR SELECT USING (user_id = auth.uid()::text);
DROP POLICY IF EXISTS "hidden_posts insert own" ON public.hidden_posts;
CREATE POLICY "hidden_posts insert own" ON public.hidden_posts
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);
DROP POLICY IF EXISTS "hidden_posts delete own" ON public.hidden_posts;
CREATE POLICY "hidden_posts delete own" ON public.hidden_posts
  FOR DELETE USING (user_id = auth.uid()::text);

-- 1e. connection_requests (user_id uuid sender, target_user_id uuid recipient)
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conn_req select participant" ON public.connection_requests;
CREATE POLICY "conn_req select participant" ON public.connection_requests
  FOR SELECT USING (user_id = auth.uid() OR target_user_id = auth.uid());
DROP POLICY IF EXISTS "conn_req insert sender" ON public.connection_requests;
CREATE POLICY "conn_req insert sender" ON public.connection_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "conn_req update participant" ON public.connection_requests;
CREATE POLICY "conn_req update participant" ON public.connection_requests
  FOR UPDATE USING (user_id = auth.uid() OR target_user_id = auth.uid());
DROP POLICY IF EXISTS "conn_req delete participant" ON public.connection_requests;
CREATE POLICY "conn_req delete participant" ON public.connection_requests
  FOR DELETE USING (user_id = auth.uid() OR target_user_id = auth.uid());

-- 1f. follows (follower_id text, following_id text)
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows select public" ON public.follows;
CREATE POLICY "follows select public" ON public.follows
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "follows insert self" ON public.follows;
CREATE POLICY "follows insert self" ON public.follows
  FOR INSERT WITH CHECK (follower_id = auth.uid()::text);
DROP POLICY IF EXISTS "follows delete self" ON public.follows;
CREATE POLICY "follows delete self" ON public.follows
  FOR DELETE USING (follower_id = auth.uid()::text);

-- 1g. offers (worker_id uuid, request_id uuid) — existing poster/worker policies
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers worker select own" ON public.offers;
CREATE POLICY "offers worker select own" ON public.offers
  FOR SELECT USING (worker_id = auth.uid());
DROP POLICY IF EXISTS "offers worker delete own" ON public.offers;
CREATE POLICY "offers worker delete own" ON public.offers
  FOR DELETE USING (worker_id = auth.uid());

-- 1h. proposals (user_id uuid, gig_id uuid)
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposals select own or gig owner" ON public.proposals;
CREATE POLICY "proposals select own or gig owner" ON public.proposals
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = proposals.gig_id AND g.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "proposals insert own" ON public.proposals;
CREATE POLICY "proposals insert own" ON public.proposals
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "proposals update own" ON public.proposals;
CREATE POLICY "proposals update own" ON public.proposals
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "proposals delete own" ON public.proposals;
CREATE POLICY "proposals delete own" ON public.proposals
  FOR DELETE USING (user_id = auth.uid());

-- 1i. user_grabs (user_id uuid grabber, provider_id uuid seller)
ALTER TABLE public.user_grabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_grabs insert own" ON public.user_grabs;
CREATE POLICY "user_grabs insert own" ON public.user_grabs
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_grabs select provider" ON public.user_grabs;
CREATE POLICY "user_grabs select provider" ON public.user_grabs
  FOR SELECT USING (provider_id = auth.uid());
DROP POLICY IF EXISTS "user_grabs update provider" ON public.user_grabs;
CREATE POLICY "user_grabs update provider" ON public.user_grabs
  FOR UPDATE USING (provider_id = auth.uid());

-- 1j. user_saves (user_id uuid)
ALTER TABLE public.user_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_saves insert own" ON public.user_saves;
CREATE POLICY "user_saves insert own" ON public.user_saves
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 1k. gigs (user_id uuid) — no frontend reads; owner + admin + active-public
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gigs select own admin active" ON public.gigs;
CREATE POLICY "gigs select own admin active" ON public.gigs
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (status IS NULL OR status NOT IN ('closed','fulfilled','cancelled'))
  );
DROP POLICY IF EXISTS "gigs insert own" ON public.gigs;
CREATE POLICY "gigs insert own" ON public.gigs
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "gigs update own" ON public.gigs;
CREATE POLICY "gigs update own" ON public.gigs
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "gigs delete own" ON public.gigs;
CREATE POLICY "gigs delete own" ON public.gigs
  FOR DELETE USING (user_id = auth.uid());

-- 1l. reviews (reviewer_id uuid, reviewed_id uuid, reviewee_id uuid)
--     existing: Read reviews (public SELECT), Write review (INSERT w/ check)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews delete own" ON public.reviews;
CREATE POLICY "reviews delete own" ON public.reviews
  FOR DELETE USING (reviewer_id = auth.uid());

-- 1m. activity_logs (user_id uuid) — admin audit log
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs select admin" ON public.activity_logs;
CREATE POLICY "activity_logs select admin" ON public.activity_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "activity_logs insert self" ON public.activity_logs;
CREATE POLICY "activity_logs insert self" ON public.activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "activity_logs update admin" ON public.activity_logs;
CREATE POLICY "activity_logs update admin" ON public.activity_logs
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "activity_logs delete admin" ON public.activity_logs;
CREATE POLICY "activity_logs delete admin" ON public.activity_logs
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 1n. analytics_events (gig_id uuid, event_type text) — telemetry, no user_id
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics select admin" ON public.analytics_events;
CREATE POLICY "analytics select admin" ON public.analytics_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "analytics insert authenticated" ON public.analytics_events;
CREATE POLICY "analytics insert authenticated" ON public.analytics_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "analytics update admin" ON public.analytics_events;
CREATE POLICY "analytics update admin" ON public.analytics_events
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "analytics delete admin" ON public.analytics_events;
CREATE POLICY "analytics delete admin" ON public.analytics_events
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 1o. live_streams (streamer_id text) — public directory
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_streams select public" ON public.live_streams;
CREATE POLICY "live_streams select public" ON public.live_streams
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_streams insert self" ON public.live_streams;
CREATE POLICY "live_streams insert self" ON public.live_streams
  FOR INSERT WITH CHECK (streamer_id = auth.uid()::text);
DROP POLICY IF EXISTS "live_streams update self" ON public.live_streams;
CREATE POLICY "live_streams update self" ON public.live_streams
  FOR UPDATE USING (streamer_id = auth.uid()::text);
DROP POLICY IF EXISTS "live_streams delete self" ON public.live_streams;
CREATE POLICY "live_streams delete self" ON public.live_streams
  FOR DELETE USING (streamer_id = auth.uid()::text);

-- 1p. swap_matches (user_id uuid, matched_user_id uuid, swap_post_id uuid)
ALTER TABLE public.swap_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swap_matches select participant" ON public.swap_matches;
CREATE POLICY "swap_matches select participant" ON public.swap_matches
  FOR SELECT USING (user_id = auth.uid() OR matched_user_id = auth.uid());
DROP POLICY IF EXISTS "swap_matches insert self" ON public.swap_matches;
CREATE POLICY "swap_matches insert self" ON public.swap_matches
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "swap_matches update participant" ON public.swap_matches;
CREATE POLICY "swap_matches update participant" ON public.swap_matches
  FOR UPDATE USING (user_id = auth.uid() OR matched_user_id = auth.uid());
DROP POLICY IF EXISTS "swap_matches delete participant" ON public.swap_matches;
CREATE POLICY "swap_matches delete participant" ON public.swap_matches
  FOR DELETE USING (user_id = auth.uid() OR matched_user_id = auth.uid());

-- 1q. swap_posts (user_id uuid) — public swap marketplace
ALTER TABLE public.swap_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swap_posts select public" ON public.swap_posts;
CREATE POLICY "swap_posts select public" ON public.swap_posts
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "swap_posts insert own" ON public.swap_posts;
CREATE POLICY "swap_posts insert own" ON public.swap_posts
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "swap_posts update own" ON public.swap_posts;
CREATE POLICY "swap_posts update own" ON public.swap_posts
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "swap_posts delete own" ON public.swap_posts;
CREATE POLICY "swap_posts delete own" ON public.swap_posts
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. PROFILE PII — column-level SELECT grants + SECURITY DEFINER RPCs
--    Public fields: id, username, full_name, avatar, bio, location, timestamps
--    Private fields: email, phone, wallet, push_token, push_token_updated_at,
--                    is_blocked, user_id (auth linkage), role (admin flag)
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, full_name, avatar, bio, location, created_at, updated_at)
  ON public.profiles TO anon, authenticated;

-- RPC: caller's own full profile (PII included), scoped to auth.uid()
DROP FUNCTION IF EXISTS public.get_my_profile();
CREATE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- RPC: username -> (id, email) for username-based login (pre-auth, anon-safe)
DROP FUNCTION IF EXISTS public.resolve_login_email(text);
CREATE FUNCTION public.resolve_login_email(p_username text)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email FROM public.profiles p
  WHERE lower(p.username) = lower(p_username) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. MARKETPLACE — listings / job_requests mutation tightening
-- ---------------------------------------------------------------------------

-- listings: drop the three `true` policies (unrestricted modify/delete)
DROP POLICY IF EXISTS "Allow delete listings" ON public.listings;
DROP POLICY IF EXISTS "Allow insert listings" ON public.listings;
DROP POLICY IF EXISTS "Allow update listings" ON public.listings;
-- (owner INSERT/UPDATE/DELETE policies already exist via user_id + host_id)

-- job_requests: replace unrestricted UPDATE with owner-or-acceptor
DROP POLICY IF EXISTS "Anyone can update job requests" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests accept open" ON public.job_requests;
CREATE POLICY "job_requests accept open" ON public.job_requests
  FOR UPDATE
  USING (status = 'open' AND accepted_by IS NULL)
  WITH CHECK (accepted_by = auth.uid());
DROP POLICY IF EXISTS "job_requests update acceptor avatar" ON public.job_requests;
CREATE POLICY "job_requests update acceptor avatar" ON public.job_requests
  FOR UPDATE
  USING (accepted_by = auth.uid())
  WITH CHECK (accepted_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. NOTIFICATIONS — restrict INSERT to the acting user
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications insert self actor" ON public.notifications;
CREATE POLICY "notifications insert self actor" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- ---------------------------------------------------------------------------
-- 5. POST_COMMENTS — require authenticated author ownership on INSERT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can add comments" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments insert self author" ON public.post_comments;
CREATE POLICY "post_comments insert self author" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

COMMIT;
