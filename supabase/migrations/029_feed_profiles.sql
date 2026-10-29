-- Home feed memory per account: welcome picks ("what's your kind of plan?"), who
-- they usually go with, and what they grabbed / saved / skipped / hid (with why),
-- so the feed follows them from phone to web. Only the owner can read or write it.
create table if not exists public.feed_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  picks text[] not null default '{}',
  going_with text check (going_with is null or going_with in ('solo', 'partner', 'friends', 'family')),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint feed_profiles_state_size check (pg_column_size(state) < 600000)
);

alter table public.feed_profiles enable row level security;

drop policy if exists "feed_profiles owner" on public.feed_profiles;
create policy "feed_profiles owner" on public.feed_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.feed_profiles from anon;
grant select, insert, update, delete on public.feed_profiles to authenticated;
