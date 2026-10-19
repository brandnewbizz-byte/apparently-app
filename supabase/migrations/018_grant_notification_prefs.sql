-- supabase/migrations/018_grant_notification_prefs.sql
--
-- Closes a grant gap introduced by migration 017: it added the
-- `profiles.notification_prefs` column (and used `push_token`/`push_token_updated_at`
-- in the push-token save path) but did NOT grant column-level access.
--
-- Migration 011 revoked table-wide SELECT/UPDATE on `profiles` and switched to
-- column-level grants, so any column without an explicit grant is unreachable
-- from the client (PostgREST returns 42501). This migration grants:
--   * SELECT + UPDATE on `notification_prefs`  (settings toggle UI read/write)
--   * UPDATE on `push_token`, `push_token_updated_at` (savePushToken write)
--
-- All UPDATE grants are constrained by the existing profiles RLS policy so a
-- user can only touch their own row.

begin;

grant select (notification_prefs), update (notification_prefs)
  on public.profiles
  to authenticated;

grant update (push_token, push_token_updated_at)
  on public.profiles
  to authenticated;

commit;
