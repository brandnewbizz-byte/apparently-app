-- =============================================================================
-- 012_canonical_identity.sql
-- FIX PART 2: Canonical User Identity
-- -----------------------------------------------------------------------------
-- Makes public.profiles the SINGLE canonical application identity, tied 1:1 to
-- auth.users. Deprecates and DROPS legacy public.users.
--
-- Fixes:
--   * @user author-resolution bug (posts referenced `users`, feed resolved via
--     `profiles` — now everything points at profiles).
--   * Merges legacy users data (is_verified, followers_count, is_live,
--     relationship_category) into profiles.
--   * Repoints all user FKs users(id) -> profiles(id).
--   * Converts TEXT identity columns -> UUID (verified: all values are valid
--     UUIDs and map to profiles.id; zero unmappable values).
--   * Rewrites handle_new_user() to create the canonical profiles row on signup.
--   * Adds profiles.id -> auth.users(id) ON DELETE CASCADE.
--   * Drops the redundant nullable profiles.user_id column (no code/FK deps).
--
-- Idempotent where possible. Reversible via backup (see GO_LIVE_AUDIT.md).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Add the 4 legacy-user data columns to profiles (additive, safe).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_verified boolean not null default false;
alter table public.profiles
  add column if not exists followers_count integer not null default 0;
alter table public.profiles
  add column if not exists is_live boolean not null default false;
alter table public.profiles
  add column if not exists relationship_category text;

-- ---------------------------------------------------------------------------
-- 2. Merge useful data from legacy public.users -> profiles.
--    (users.name is redundant with profiles.full_name, which is already the
--     canonical display name and is left untouched.)
-- ---------------------------------------------------------------------------
update public.profiles p
set
  is_verified           = coalesce(u.is_verified, false),
  followers_count       = coalesce(u.followers_count, 0),
  is_live               = coalesce(u.is_live, false),
  relationship_category = u.relationship_category
from public.users u
where p.id = u.id;

-- ---------------------------------------------------------------------------
-- 3. Reconcile profiles.user_id (3 NULL rows = real auth accounts; no true
--    orphans). Backfill user_id = id, then drop the redundant column later.
-- ---------------------------------------------------------------------------
update public.profiles set user_id = id where user_id is null;

-- ---------------------------------------------------------------------------
-- 4. Repoint user FKs: users(id) -> profiles(id). 11 tables.
--    Preserve each constraint's original ON DELETE behavior exactly.
-- ---------------------------------------------------------------------------
-- (originally no ON DELETE)
alter table public.posts drop constraint if exists posts_user_id_fkey;
alter table public.posts add constraint posts_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.stories drop constraint if exists stories_user_id_fkey;
alter table public.stories add constraint stories_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.product_inquiries drop constraint if exists product_inquiries_user_id_fkey;
alter table public.product_inquiries add constraint product_inquiries_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.calendar_events drop constraint if exists calendar_events_user_id_fkey;
alter table public.calendar_events add constraint calendar_events_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.income_sources drop constraint if exists income_sources_user_id_fkey;
alter table public.income_sources add constraint income_sources_user_id_fkey
  foreign key (user_id) references public.profiles(id);

-- (originally ON DELETE CASCADE)
alter table public.bills drop constraint if exists bills_user_id_fkey;
alter table public.bills add constraint bills_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.relationships drop constraint if exists relationships_user_id_fkey;
alter table public.relationships add constraint relationships_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.pipelines drop constraint if exists pipelines_user_id_fkey;
alter table public.pipelines add constraint pipelines_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.market_watch drop constraint if exists market_watch_user_id_fkey;
alter table public.market_watch add constraint market_watch_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.post_likes drop constraint if exists post_likes_user_id_fkey;
alter table public.post_likes add constraint post_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.post_comments drop constraint if exists post_comments_author_id_fkey;
alter table public.post_comments add constraint post_comments_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 5a. DROP policies that reference the TEXT identity columns (PostgreSQL
--     refuses to alter a column type while a policy references it). They are
--     re-created with uuid comparison in 5c.
-- ---------------------------------------------------------------------------
drop policy if exists "reports insert self" on public.reports;

drop policy if exists "hidden_posts select own" on public.hidden_posts;
drop policy if exists "hidden_posts insert own" on public.hidden_posts;
drop policy if exists "hidden_posts delete own" on public.hidden_posts;

drop policy if exists "follows insert self" on public.follows;
drop policy if exists "follows delete self" on public.follows;

drop policy if exists "live_streams insert self" on public.live_streams;
drop policy if exists "live_streams update self" on public.live_streams;
drop policy if exists "live_streams delete self" on public.live_streams;

-- ---------------------------------------------------------------------------
-- 5b. Convert TEXT identity columns -> UUID, then add FKs -> profiles(id).
--     Pre-verified: every non-null value is a valid UUID that exists in
--     profiles.id. (messages.receiver_id is nullable; NULL stays NULL.)
-- ---------------------------------------------------------------------------
alter table public.follows alter column follower_id type uuid using follower_id::uuid;
alter table public.follows alter column following_id type uuid using following_id::uuid;
alter table public.hidden_posts alter column user_id type uuid using user_id::uuid;
alter table public.live_streams alter column streamer_id type uuid using streamer_id::uuid;
alter table public.messages alter column receiver_id type uuid using receiver_id::uuid;
alter table public.reports alter column reported_by type uuid using reported_by::uuid;

alter table public.follows add constraint follows_follower_id_fkey
  foreign key (follower_id) references public.profiles(id) on delete cascade;
alter table public.follows add constraint follows_following_id_fkey
  foreign key (following_id) references public.profiles(id) on delete cascade;
alter table public.hidden_posts add constraint hidden_posts_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.live_streams add constraint live_streams_streamer_id_fkey
  foreign key (streamer_id) references public.profiles(id) on delete cascade;
alter table public.messages add constraint messages_receiver_id_fkey
  foreign key (receiver_id) references public.profiles(id) on delete cascade;
alter table public.reports add constraint reports_reported_by_fkey
  foreign key (reported_by) references public.profiles(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 5c. Re-create the policies with uuid = auth.uid() comparison.
-- ---------------------------------------------------------------------------
create policy "reports insert self" on public.reports
  for insert with check (reported_by = auth.uid());

create policy "hidden_posts select own" on public.hidden_posts
  for select using (user_id = auth.uid());
create policy "hidden_posts insert own" on public.hidden_posts
  for insert with check (user_id = auth.uid());
create policy "hidden_posts delete own" on public.hidden_posts
  for delete using (user_id = auth.uid());

create policy "follows insert self" on public.follows
  for insert with check (follower_id = auth.uid());
create policy "follows delete self" on public.follows
  for delete using (follower_id = auth.uid());

create policy "live_streams insert self" on public.live_streams
  for insert with check (streamer_id = auth.uid());
create policy "live_streams update self" on public.live_streams
  for update using (streamer_id = auth.uid());
create policy "live_streams delete self" on public.live_streams
  for delete using (streamer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Drop the redundant profiles.user_id column (now user_id = id everywhere;
--    no code or FK references it). First drop the two profiles INSERT policies
--    that referenced user_id (recreated below against the canonical id column).
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Allow profile insert after signup" on public.profiles;

alter table public.profiles drop column if exists user_id;

create policy "Admins can insert profiles" on public.profiles
  for insert to public
  with check (has_role(auth.uid(), 'admin'::app_role) or (auth.uid() = id));
create policy "Allow profile insert after signup" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 7. profiles.id -> auth.users(id) ON DELETE CASCADE (true 1:1 identity).
--    PK (id) already prevents multiple profiles per auth account.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 8. Rewrite handle_new_user(): signup creates the canonical profiles row.
--    Safe, idempotent, SECURITY DEFINER, explicit search_path,
--    username-uniqueness compatible.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, email, avatar)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username', ''),
             'user_' || substr(replace(new.id::text, '-', ''), 1, 12)),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''),
             nullif(new.raw_user_meta_data->>'name', ''), 'User'),
    new.email,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id::text
  )
  on conflict (id) do nothing;
  return new;
exception when unique_violation then
  -- Never break auth signup: the app upserts the canonical profile (with the
  -- user's chosen handle) immediately after signup.
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Drop legacy public.users. All conditions met:
--       * zero active code deps (avatar-sync + backend route repointed)
--       * zero required FK deps (all 11 repointed above)
--       * useful data migrated (step 2)
--       * all 21 posts resolve via profiles
--       * signup no longer writes it (step 8)
-- ---------------------------------------------------------------------------
drop table if exists public.users;

-- ---------------------------------------------------------------------------
-- 10. Extend profiles column-level SELECT grants to the 4 new public columns.
--     (Part 1 revoked table-wide SELECT; new columns must be granted
--      explicitly or the feed's select('*') won't return them.)
-- ---------------------------------------------------------------------------
grant select (id, username, full_name, avatar, bio, location,
              is_verified, followers_count, is_live, relationship_category,
              created_at, updated_at)
  on public.profiles to anon, authenticated;

commit;
