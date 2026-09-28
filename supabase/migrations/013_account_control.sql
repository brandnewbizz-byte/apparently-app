-- =============================================================================
-- 013_account_control.sql
-- FIX PART 3 — Account control + admin security
-- -----------------------------------------------------------------------------
-- 1. Enforce blocked accounts (is_blocked authoritative at DB level).
-- 2. Canonical admin system (user_roles + has_role only).
-- 3. Harden SECURITY DEFINER functions (search_path, minimum data).
--
-- Reversible: every statement is idempotent (CREATE OR REPLACE / DROP IF EXISTS).
-- =============================================================================

-- =============================================================================
-- SECTION 1 — SECURITY DEFINER FUNCTION HARDENING
-- =============================================================================

-- 1a. update_conversation_last_message(): was MISSING SET search_path (search_path
--     injection risk). Add explicit empty search_path + schema-qualify target.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.conversations SET last_message_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

-- 1b. resolve_login_email(): return ONLY the email (minimum data needed for the
--     username->email login flow). Drop the `id` column from the result set.
--     (DROP first: the return type changes from (id uuid, email text) to (email text),
--     which CREATE OR REPLACE cannot do in-place.)
DROP FUNCTION IF EXISTS public.resolve_login_email(text);
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_username text)
 RETURNS TABLE(email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.email FROM public.profiles p
  WHERE lower(p.username) = lower(p_username) LIMIT 1;
$function$;

-- 1c. get_user_role(uuid): unused in code + caller-controlled user_id (role
--     enumeration / disclosure). Admin authority is has_role() only. Drop it.
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- 1d. is_user_blocked(): self-only blocking helper (no args -> no caller-controlled
--     enumeration). SECURITY DEFINER reads auth.uid()'s own is_blocked flag.
CREATE OR REPLACE FUNCTION public.is_user_blocked()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE((SELECT is_blocked FROM public.profiles WHERE id = auth.uid()), false);
$function$;

REVOKE ALL ON FUNCTION public.is_user_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_blocked() TO authenticated, anon;

-- =============================================================================
-- SECTION 2 — BLOCK-BYPASS PREVENTION (column privileges)
-- =============================================================================
-- anon/authenticated hold TABLE-LEVEL INSERT/UPDATE/REFERENCES on profiles
-- (relacl = awdDxtm), which grants write on ALL columns including is_blocked.
-- A column-level REVOKE cannot override a table-level grant in PostgreSQL, so
-- the previous approach was ineffective. The correct fix: revoke the table-level
-- write privileges, then re-grant column-level write ONLY on the user-editable
-- safe columns. Server-managed fields (is_blocked, is_verified, followers_count,
-- is_live, relationship_category, wallet, push_token, push_token_updated_at,
-- created_at) become non-writable by clients. Admin blocking/unblocking happens
-- via service_role (backend), which retains full table privileges and is
-- unaffected.

-- Step 1: remove table-level write privileges from client roles.
REVOKE INSERT, UPDATE, REFERENCES ON public.profiles FROM anon, authenticated;

-- Step 2: re-grant column-level write on the user-editable columns only.
GRANT INSERT (id, full_name, username, bio, avatar, location, phone, email, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, username, bio, avatar, location, phone, email, updated_at) ON public.profiles TO authenticated;

-- =============================================================================
-- SECTION 3 — CANONICAL ADMIN SYSTEM
-- =============================================================================

-- 3a. admin_users: 0 rows, zero FK deps (only self-referential policy), no code
--     references. Drop it. (Policy drops with the table.)
DROP TABLE IF EXISTS public.admin_users;

-- 3b. profiles.role: broken TEXT literal column (default '''user''::text'::text),
--     zero policy/function/view dependencies. Admin authority lives in user_roles
--     via has_role(). Drop it.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 3c. user_roles: remove anon/authenticated table-level grants. RLS is already ON
--     with no policies (deny-by-default), so this is defense-in-depth so
--     authenticated clients cannot read/write the role table directly.
--     has_role() is SECURITY DEFINER and bypasses these grants, so admin checks
--     keep working.
REVOKE ALL ON public.user_roles FROM anon, authenticated;

-- 3d. Drop the 2 dead listings SELECT policies that used the JWT role (never
--     'admin' in practice). Listings SELECT is already public, so admin-specific
--     SELECT adds nothing. Removing these canonicalizes to has_role() semantics.
DROP POLICY IF EXISTS "Admin Full Access" ON public.listings;
DROP POLICY IF EXISTS "Admins see all" ON public.listings;

-- =============================================================================
-- =============================================================================
-- SECTION 4 — BLOCKED-USER WRITE ENFORCEMENT (generated guards)
-- =============================================================================
-- These ALTER POLICY statements append "AND NOT public.is_user_blocked()" to every
-- owner-scoped write policy on core content tables. Reads and admin (has_role)
-- policies are intentionally left untouched. Regenerated from live pg_policies.
ALTER POLICY "Users can create bookings" ON public."bookings" WITH CHECK (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own bookings" ON public."bookings" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own bundles" ON public."bundles" WITH CHECK (((auth.uid() IS NOT NULL)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own bundles" ON public."bundles" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own bundles" ON public."bundles" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "conn_req delete participant" ON public."connection_requests" USING ((((user_id = auth.uid()) OR (target_user_id = auth.uid()))) AND (NOT public.is_user_blocked()));
ALTER POLICY "conn_req insert sender" ON public."connection_requests" WITH CHECK (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "conn_req update participant" ON public."connection_requests" USING ((((user_id = auth.uid()) OR (target_user_id = auth.uid()))) AND (NOT public.is_user_blocked()));
ALTER POLICY "conversations delete participant" ON public."conversations" USING ((((auth.uid() = participant_one) OR (auth.uid() = participant_two))) AND (NOT public.is_user_blocked()));
ALTER POLICY "conversations insert participant" ON public."conversations" WITH CHECK ((((auth.uid() = participant_one) OR (auth.uid() = participant_two))) AND (NOT public.is_user_blocked()));
ALTER POLICY "conversations update participant" ON public."conversations" USING ((((auth.uid() = participant_one) OR (auth.uid() = participant_two))) AND (NOT public.is_user_blocked()));
ALTER POLICY "follows delete self" ON public."follows" USING (((follower_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "follows insert self" ON public."follows" WITH CHECK (((follower_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "gigs delete own" ON public."gigs" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "gigs insert own" ON public."gigs" WITH CHECK (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "gigs update own" ON public."gigs" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own job requests" ON public."job_requests" WITH CHECK (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own job requests" ON public."job_requests" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own job requests" ON public."job_requests" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "job_requests accept open" ON public."job_requests" USING ((((status = 'open'::text) AND (accepted_by IS NULL))) AND (NOT public.is_user_blocked())) WITH CHECK (((accepted_by = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "job_requests update acceptor avatar" ON public."job_requests" USING (((accepted_by = auth.uid())) AND (NOT public.is_user_blocked())) WITH CHECK (((accepted_by = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Edit own listings" ON public."listings" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Insert own listings" ON public."listings" WITH CHECK (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own listings" ON public."listings" WITH CHECK (((auth.uid() = host_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own listings" ON public."listings" USING (((auth.uid() = host_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own listings" ON public."listings" USING (((auth.uid() = host_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users insert own posts" ON public."listings" WITH CHECK (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can send messages in own conversations" ON public."messages" WITH CHECK ((((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_one = auth.uid()) OR (conversations.participant_two = auth.uid()))))))) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own messages" ON public."messages" USING (((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_one = auth.uid()) OR (conversations.participant_two = auth.uid())))))) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own notifications" ON public."notifications" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own notifications" ON public."notifications" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "notifications insert self actor" ON public."notifications" WITH CHECK (((auth.uid() = actor_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Poster responds to offer" ON public."offers" USING (((EXISTS ( SELECT 1
   FROM requests
  WHERE ((requests.id = offers.request_id) AND (requests.user_id = auth.uid()))))) AND (NOT public.is_user_blocked())) WITH CHECK (((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]))) AND (NOT public.is_user_blocked()));
ALTER POLICY "Workers can send offers" ON public."offers" WITH CHECK ((((auth.uid() = worker_id) AND (EXISTS ( SELECT 1
   FROM requests
  WHERE ((requests.id = offers.request_id) AND (requests.status = 'open'::text)))))) AND (NOT public.is_user_blocked()));
ALTER POLICY "offers worker delete own" ON public."offers" USING (((worker_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own comments" ON public."post_comments" USING (((auth.uid() = author_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "post_comments insert self author" ON public."post_comments" WITH CHECK (((auth.uid() = author_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can like posts" ON public."post_likes" WITH CHECK (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can unlike posts" ON public."post_likes" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own posts" ON public."posts" WITH CHECK (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own posts" ON public."posts" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own posts" ON public."posts" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own products" ON public."products" WITH CHECK (((auth.uid() = seller_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own products" ON public."products" USING (((auth.uid() = seller_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Allow profile insert after signup" ON public."profiles" WITH CHECK (((auth.uid() = id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can insert own profile" ON public."profiles" WITH CHECK (((auth.uid() = id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can insert their own profile" ON public."profiles" WITH CHECK (((auth.uid() = id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own profile" ON public."profiles" USING (((auth.uid() = id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update their own profile" ON public."profiles" USING (((auth.uid() = id)) AND (NOT public.is_user_blocked())) WITH CHECK (((auth.uid() = id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Write review" ON public."reviews" WITH CHECK ((((EXISTS ( SELECT 1
   FROM requests
  WHERE ((requests.id = reviews.request_id) AND ((requests.user_id = reviews.reviewed_id) OR (requests.user_id = auth.uid()))))) AND (auth.uid() = reviewer_id))) AND (NOT public.is_user_blocked()));
ALTER POLICY "reviews delete own" ON public."reviews" USING (((reviewer_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own skill deals" ON public."skill_deals" WITH CHECK (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own skill deals" ON public."skill_deals" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can update own skill deals" ON public."skill_deals" USING (((user_id = auth.uid())) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can create own stories" ON public."stories" WITH CHECK (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
ALTER POLICY "Users can delete own stories" ON public."stories" USING (((auth.uid() = user_id)) AND (NOT public.is_user_blocked()));
