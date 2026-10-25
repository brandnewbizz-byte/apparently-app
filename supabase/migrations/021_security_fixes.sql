-- 021 — Security / access fixes found by the Supabase security advisor.
-- Safe to run more than once. Does not delete any data.
--
--   1. saved_posts had RLS on but no policies → bookmarking a post never saved
--   2. user_reviews had RLS on but no policies → profile ratings could never load
--   3. user_roles had RLS on but no policies → users can read their own role
--   4. dispatch_push() could be called by anyone (even signed-out) to send
--      push notifications to any user — now only callable internally
--   5. Trigger/helper functions no longer callable directly from the API

-- 1. saved_posts — each user manages only their own bookmarks
drop policy if exists "saved_posts select own" on public.saved_posts;
create policy "saved_posts select own" on public.saved_posts
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "saved_posts insert own" on public.saved_posts;
create policy "saved_posts insert own" on public.saved_posts
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "saved_posts delete own" on public.saved_posts;
create policy "saved_posts delete own" on public.saved_posts
  for delete to authenticated using (user_id = auth.uid());

-- 2. user_reviews — public to read; you can only write your own review of someone else
drop policy if exists "user_reviews select public" on public.user_reviews;
create policy "user_reviews select public" on public.user_reviews
  for select using (true);
drop policy if exists "user_reviews insert own" on public.user_reviews;
create policy "user_reviews insert own" on public.user_reviews
  for insert to authenticated
  with check (reviewer_id = auth.uid() and reviewer_id <> target_user_id);
drop policy if exists "user_reviews update own" on public.user_reviews;
create policy "user_reviews update own" on public.user_reviews
  for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
drop policy if exists "user_reviews delete own" on public.user_reviews;
create policy "user_reviews delete own" on public.user_reviews
  for delete to authenticated using (reviewer_id = auth.uid());

-- 3. user_roles — read your own role only (writes stay admin/service-role only)
drop policy if exists "user_roles select own" on public.user_roles;
create policy "user_roles select own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- 4 + 5. Internal functions: not callable through the public API.
-- Triggers and other SECURITY DEFINER functions still run them normally.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.dispatch_push(uuid, text, text, jsonb)',
    'public.notify_on_message_insert()',
    'public.notify_on_notification_insert()',
    'public.update_conversation_last_message()',
    'public.push_enabled_for(uuid, text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- Signed-in-only helpers (no reason for signed-out callers)
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.is_blocked_by(uuid)',
    'public.delete_my_account()',
    'public.increment_deal_stat(text, uuid, text)',
    'public.grab_bundle(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;
