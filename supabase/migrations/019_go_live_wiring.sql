-- 019 — Go-live wiring
-- Adds the database pieces the app now relies on. Every statement is
-- idempotent, so this is safe to run more than once.
--
--   1. user_blocks            — "Block User" (the app wrote to a non-existent `blocks` table)
--   2. delete_my_account()    — in-app account deletion (required by Apple / Google)
--   3. increment_deal_stat()  — bundle/skill view & grab counters for non-owners
--   4. realtime for messages + notifications (live chat, unread badges)
--   5. `messages` storage bucket + policies (chat photos and voice notes)

-- ─────────────────────────────────────────────────────────────
-- 1. user_blocks
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks select own" on public.user_blocks;
create policy "user_blocks select own" on public.user_blocks
  for select to authenticated using (auth.uid() = blocker_id);

drop policy if exists "user_blocks insert own" on public.user_blocks;
create policy "user_blocks insert own" on public.user_blocks
  for insert to authenticated with check (auth.uid() = blocker_id);

drop policy if exists "user_blocks update own" on public.user_blocks;
create policy "user_blocks update own" on public.user_blocks
  for update to authenticated using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "user_blocks delete own" on public.user_blocks;
create policy "user_blocks delete own" on public.user_blocks
  for delete to authenticated using (auth.uid() = blocker_id);

-- A blocked user can't message the person who blocked them.
create or replace function public.is_blocked_by(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = p_other and blocked_id = auth.uid()
  );
$$;
grant execute on function public.is_blocked_by(uuid) to authenticated;

drop policy if exists "messages insert not blocked" on public.messages;
create policy "messages insert not blocked" on public.messages
  as restrictive
  for insert to authenticated
  with check (receiver_id is null or not public.is_blocked_by(receiver_id));

-- ─────────────────────────────────────────────────────────────
-- 2. delete_my_account()
-- Deletes the caller's auth user. profiles.id → auth.users is ON DELETE
-- CASCADE (migration 012), and user-owned rows cascade from profiles.
-- ─────────────────────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. increment_deal_stat(kind, id, column)
-- Viewers don't own bundles/skill_deals rows, so RLS blocks a plain UPDATE.
-- Only the grabs/views counters can be touched, and only by +1.
-- ─────────────────────────────────────────────────────────────
create or replace function public.increment_deal_stat(p_kind text, p_id uuid, p_column text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_column not in ('grabs', 'views') then
    raise exception 'Invalid column %', p_column;
  end if;
  if p_kind = 'bundle' then
    execute format('update public.bundles set %I = coalesce(%I, 0) + 1 where id = $1', p_column, p_column) using p_id;
  elsif p_kind = 'skill' then
    execute format('update public.skill_deals set %I = coalesce(%I, 0) + 1 where id = $1', p_column, p_column) using p_id;
  else
    raise exception 'Invalid kind %', p_kind;
  end if;
end;
$$;
revoke all on function public.increment_deal_stat(text, uuid, text) from public, anon;
grant execute on function public.increment_deal_stat(text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Realtime publication
-- ─────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'notifications', 'conversations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. `messages` storage bucket (private)
-- Paths used by the app: voice/<recipient_id>/<file>, images/<recipient_id>/<file>
-- Uploader owns the object; the recipient (folder 2) can read it.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('messages', 'messages', false)
on conflict (id) do nothing;

drop policy if exists "messages bucket upload" on storage.objects;
create policy "messages bucket upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'messages' and owner = auth.uid());

drop policy if exists "messages bucket read" on storage.objects;
create policy "messages bucket read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messages'
    and (owner = auth.uid() or (storage.foldername(name))[2] = auth.uid()::text)
  );

drop policy if exists "messages bucket delete own" on storage.objects;
create policy "messages bucket delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'messages' and owner = auth.uid());
