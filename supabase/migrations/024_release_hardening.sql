-- Release hardening (supersedes 023, which was never applied).
--
--  1. Usernames: one per person, case-insensitive, normalised to lowercase,
--     3–30 chars of a-z 0-9 . _ ; signup never loses the profile row when the
--     chosen handle was taken in a race.
--  2. Planner help requests: open jobs can actually be accepted (atomic RPC).
--  3. One grab per person per item.
--  4. Skill deals get a grab limit like bundles (available_count + grab RPC).
--  5. Spot items can only be deleted by their owner or the room host.
--  6. Pin search_path on trigger functions flagged by the linter.

-- ── 1. Usernames ───────────────────────────────────────────────────────────
create or replace function public.normalize_username()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is not null then
    new.username := lower(btrim(new.username));
  end if;
  if new.username is null or new.username = '' then
    new.username := 'user_' || substring(replace(new.id::text, '-', ''), 1, 10);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username
  before insert or update of username on public.profiles
  for each row execute function public.normalize_username();

update public.profiles set username = lower(btrim(username)) where username <> lower(btrim(username));

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9._]{3,30}$') not valid;
alter table public.profiles validate constraint profiles_username_format;

create or replace function public.auto_generate_username()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is null or new.username = '' then
    new.username := 'user_' || substring(replace(new.id::text, '-', ''), 1, 10);
  end if;
  return new;
end;
$$;

-- Signup: if the chosen handle was taken in the meantime, still create the
-- profile (with a generated handle) instead of leaving the account without one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), 'User');
  v_wanted text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
begin
  if v_wanted !~ '^[a-z0-9._]{3,30}$'
     or exists (select 1 from public.profiles where lower(username) = v_wanted) then
    v_wanted := v_fallback;
  end if;
  begin
    insert into public.profiles (id, username, full_name, email, avatar)
    values (new.id, v_wanted, v_name, new.email,
            'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id::text)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, full_name, email, avatar)
    values (new.id, v_fallback, v_name, new.email,
            'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id::text)
    on conflict (id) do nothing;
  end;
  return new;
exception when others then
  -- Never block auth signup.
  return new;
end;
$$;

-- ── 2. Planner help requests ───────────────────────────────────────────────
drop policy if exists "job_requests accept open" on public.job_requests;
create policy "job_requests accept open" on public.job_requests for update
  using (status = 'pending' and accepted_by is null and user_id <> auth.uid() and not is_user_blocked())
  with check (accepted_by = auth.uid() and not is_user_blocked());

create or replace function public.accept_job_request(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.job_requests%rowtype;
  v_name text;
  v_avatar text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if public.is_user_blocked() then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;
  select * into v_job from public.job_requests where id = p_job for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_job.user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own_request');
  end if;
  if v_job.accepted_by is not null or v_job.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', case when v_job.accepted_by = v_uid then 'already_grabbed' else 'taken' end);
  end if;
  select coalesce(full_name, username, 'Helper'), coalesce(avatar, '') into v_name, v_avatar
    from public.profiles where id = v_uid;
  update public.job_requests
     set status = 'accepted', accepted_by = v_uid, accepted_by_name = v_name,
         accepted_by_avatar = v_avatar, updated_at = now()
   where id = p_job;
  return jsonb_build_object('ok', true, 'owner_id', v_job.user_id);
end;
$$;
revoke all on function public.accept_job_request(uuid) from public, anon;
grant execute on function public.accept_job_request(uuid) to authenticated;

create index if not exists job_requests_open_idx
  on public.job_requests (created_at desc) where status = 'pending' and accepted_by is null;

-- ── 3. One grab per person per item ────────────────────────────────────────
delete from public.user_grabs g
 using public.user_grabs newer
 where g.user_id = newer.user_id and g.item_type = newer.item_type and g.item_id = newer.item_id
   and (g.created_at, g.id::text) < (newer.created_at, newer.id::text);
create unique index if not exists user_grabs_one_per_item
  on public.user_grabs (user_id, item_type, item_id);

-- ── 4. Skill deal grab limit ───────────────────────────────────────────────
alter table public.skill_deals add column if not exists available_count integer not null default 20;
alter table public.skill_deals drop constraint if exists skill_deals_available_count_positive;
alter table public.skill_deals add constraint skill_deals_available_count_positive check (available_count >= 1);

create or replace function public.grab_skill_deal(p_skill uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := auth.uid();
  s public.skill_deals%rowtype;
  new_grabs integer;
begin
  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  select * into s from public.skill_deals where id = p_skill for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if s.user_id = v or s.creator_id = v then
    return jsonb_build_object('ok', false, 'reason', 'own');
  end if;
  if exists (select 1 from public.user_grabs where user_id = v and item_id = p_skill::text and item_type = 'deal'
             and coalesce(status, '') <> 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'already_grabbed');
  end if;
  if s.status <> 'active' or coalesce(s.grabs, 0) >= s.available_count then
    return jsonb_build_object('ok', false, 'reason', 'full', 'spots_left', 0);
  end if;
  new_grabs := coalesce(s.grabs, 0) + 1;
  update public.skill_deals
     set grabs = new_grabs,
         status = case when new_grabs >= s.available_count then 'paused' else status end,
         updated_at = now()
   where id = p_skill;
  return jsonb_build_object('ok', true, 'grabs', new_grabs, 'available_count', s.available_count,
                            'spots_left', greatest(s.available_count - new_grabs, 0));
end;
$$;
revoke all on function public.grab_skill_deal(uuid) from public, anon;
grant execute on function public.grab_skill_deal(uuid) to authenticated;

-- Bundles: a full bundle used to be set to 'grabbed', which bundles.status
-- doesn't allow, so grabbing the last spot always failed. Use 'paused'.
create or replace function public.grab_bundle(p_bundle uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := auth.uid();
  b public.bundles%rowtype;
  new_grabs integer;
begin
  if v is null then
    raise exception 'Not signed in';
  end if;
  select * into b from public.bundles where id = p_bundle for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if b.user_id = v or b.creator_id = v then
    return jsonb_build_object('ok', false, 'reason', 'own_bundle');
  end if;
  if exists (select 1 from public.user_grabs where user_id = v and item_id = p_bundle::text and item_type = 'bundle'
             and coalesce(status, '') <> 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'already_grabbed',
      'grabs', coalesce(b.grabs, 0), 'available_count', b.available_count,
      'spots_left', greatest(b.available_count - coalesce(b.grabs, 0), 0));
  end if;
  if coalesce(b.grabs, 0) >= b.available_count then
    return jsonb_build_object('ok', false, 'reason', 'full',
      'grabs', coalesce(b.grabs, 0), 'available_count', b.available_count, 'spots_left', 0);
  end if;
  new_grabs := coalesce(b.grabs, 0) + 1;
  update public.bundles
     set grabs = new_grabs,
         status = case when new_grabs >= b.available_count then 'paused' else status end,
         updated_at = now()
   where id = p_bundle;
  return jsonb_build_object('ok', true, 'grabs', new_grabs, 'available_count', b.available_count,
    'spots_left', greatest(b.available_count - new_grabs, 0));
end;
$$;

-- ── 5. Spot items: only owner or host can delete ───────────────────────────
drop policy if exists "VRO delete" on public.virtual_room_objects;
create policy "VRO delete" on public.virtual_room_objects for delete to authenticated
  using (owner_id = auth.uid()
         or exists (select 1 from public.rooms r where r.id = virtual_room_objects.room_id and r.creator_id = auth.uid()));
drop policy if exists "VRO update" on public.virtual_room_objects;
create policy "VRO update" on public.virtual_room_objects for update to authenticated
  using (true) with check (true);
drop policy if exists "VRO insert" on public.virtual_room_objects;
create policy "VRO insert" on public.virtual_room_objects for insert to authenticated
  with check (owner_id = auth.uid());

-- ── 6. Linter: pin search_path ─────────────────────────────────────────────
alter function public.update_updated_at_column() set search_path = public;
alter function public.update_profiles_updated_at() set search_path = public;
do $$ begin
  perform 1 from pg_proc where proname = 'inc_listing_view' and pronamespace = 'public'::regnamespace;
  if found then execute (select 'alter function public.inc_listing_view(' || pg_get_function_identity_arguments(oid) || ') set search_path = public'
                          from pg_proc where proname = 'inc_listing_view' and pronamespace = 'public'::regnamespace limit 1); end if;
end $$;
