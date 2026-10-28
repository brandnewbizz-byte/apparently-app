-- Subscriptions: Free / Basic / Plus / Pro (14-day free trial on paid tiers).
--
--   Free   7 card actions a day (grab or skip), no saving, can grab bundles and
--          take jobs, can't post bundles/skills/requests/jobs, no Spot, 1 GB.
--   Basic  30 actions/day, save cards, 3 live listings, 1 Spot room, 10 GB.
--   Plus   100 actions/day, 15 live listings, 5 Spot rooms, 50 GB.
--   Pro    unlimited actions, listings and rooms, 200 GB.
--
-- The store (App Store / Google Play via RevenueCat) is the source of truth;
-- the `revenuecat` edge function writes `subscriptions`. Clients can only read.

-- Master switch: limits only apply once the store products are live.
-- Turn on with: update public.app_settings set value = 'true' where key = 'subscriptions_enforced';
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings read" on public.app_settings;
create policy "app_settings read" on public.app_settings for select to anon, authenticated using (true);
drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write" on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
insert into public.app_settings (key, value) values ('subscriptions_enforced', 'false') on conflict (key) do nothing;

create or replace function public.subscriptions_enforced()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'subscriptions_enforced'), false)
$$;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'basic', 'plus', 'pro')),
  status text not null default 'inactive'
    check (status in ('active', 'trialing', 'grace', 'cancelled', 'expired', 'inactive')),
  is_trial boolean not null default false,
  product_id text,
  store text,
  period_end timestamptz,
  will_renew boolean,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions select own" on public.subscriptions;
create policy "subscriptions select own" on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Tier a person has right now ('cancelled' keeps access until the period ends).
create or replace function public.active_tier(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select tier from public.subscriptions
     where user_id = p_user
       and status in ('active', 'trialing', 'grace', 'cancelled')
       and (period_end is null or period_end > now())
  ), 'free')
$$;

-- What each tier allows. null = unlimited.
create or replace function public.tier_limits(p_tier text)
returns jsonb language sql immutable set search_path = public as $$
  select case p_tier
    when 'pro'   then jsonb_build_object('actions', null, 'can_save', true,  'listings', null, 'spot_rooms', null, 'storage_gb', 200)
    when 'plus'  then jsonb_build_object('actions', 100,  'can_save', true,  'listings', 15,   'spot_rooms', 5,    'storage_gb', 50)
    when 'basic' then jsonb_build_object('actions', 30,   'can_save', true,  'listings', 3,    'spot_rooms', 1,    'storage_gb', 10)
    else              jsonb_build_object('actions', 7,    'can_save', false, 'listings', 0,    'spot_rooms', 0,    'storage_gb', 1)
  end
$$;

-- ── Card actions (grab / skip / save on Home) ─────────────────────────────
create table if not exists public.card_actions (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null check (action in ('grab', 'skip', 'save')),
  item_type text,
  item_id text,
  created_at timestamptz not null default now()
);
create index if not exists card_actions_user_time on public.card_actions (user_id, created_at desc);
alter table public.card_actions enable row level security;
drop policy if exists "card_actions select own" on public.card_actions;
create policy "card_actions select own" on public.card_actions for select to authenticated
  using (user_id = auth.uid());

-- Spend one action. Limits are per rolling 24 hours.
create or replace function public.use_card_action(p_action text, p_item_type text default null, p_item_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := auth.uid();
  t text;
  lim jsonb;
  cap int;
  used int;
  oldest timestamptz;
begin
  if v is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if p_action not in ('grab', 'skip', 'save') then return jsonb_build_object('ok', false, 'reason', 'bad_action'); end if;
  if not public.subscriptions_enforced() then return jsonb_build_object('ok', true, 'enforced', false); end if;
  t := public.active_tier(v);
  lim := public.tier_limits(t);
  if p_action = 'save' and not (lim->>'can_save')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'needs_plan', 'tier', t);
  end if;
  cap := (lim->>'actions')::int;
  select count(*), min(created_at) into used, oldest
    from public.card_actions where user_id = v and created_at > now() - interval '24 hours';
  if cap is not null and used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'tier', t, 'limit', cap, 'used', used,
                              'resets_at', oldest + interval '24 hours');
  end if;
  insert into public.card_actions (user_id, action, item_type, item_id) values (v, p_action, p_item_type, p_item_id);
  return jsonb_build_object('ok', true, 'tier', t, 'limit', cap,
                            'remaining', case when cap is null then null else cap - used - 1 end);
end;
$$;
revoke all on function public.use_card_action(text, text, text) from public, anon;
grant execute on function public.use_card_action(text, text, text) to authenticated;

-- ── Listings, rooms, storage ──────────────────────────────────────────────
create or replace function public.active_listing_count(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.bundles where (user_id = p_user or creator_id = p_user) and status = 'active')
  + (select count(*) from public.skill_deals where (user_id = p_user or creator_id = p_user) and status = 'active')
  + (select count(*) from public.service_requests where (requester_id = p_user or creator_id = p_user) and status in ('open', 'in_progress'))
  + (select count(*) from public.job_requests where user_id = p_user and status in ('pending', 'accepted', 'in_progress'))
$$;

create or replace function public.can_post_listing(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cap int; t text;
begin
  if p_user is null then return false; end if;
  if not public.subscriptions_enforced() or public.has_role(p_user, 'admin') then return true; end if;
  t := public.active_tier(p_user);
  if t = 'free' then return false; end if;
  cap := (public.tier_limits(t)->>'listings')::int;
  return cap is null or public.active_listing_count(p_user) < cap;
end;
$$;

create or replace function public.can_create_room(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cap int; t text; n int;
begin
  if p_user is null then return false; end if;
  if not public.subscriptions_enforced() or public.has_role(p_user, 'admin') then return true; end if;
  t := public.active_tier(p_user);
  if t = 'free' then return false; end if;
  cap := (public.tier_limits(t)->>'spot_rooms')::int;
  select count(*) into n from public.rooms where creator_id = p_user;
  return cap is null or n < cap;
end;
$$;

create or replace function public.storage_used_bytes(p_user uuid)
returns bigint language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
    from storage.objects
   where owner_id = p_user::text or owner = p_user
$$;

-- Before uploading: is there room for this many bytes?
create or replace function public.can_upload(p_bytes bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); t text; cap bigint; used bigint;
begin
  if v is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if not public.subscriptions_enforced() then return jsonb_build_object('ok', true, 'enforced', false); end if;
  t := public.active_tier(v);
  cap := ((public.tier_limits(t)->>'storage_gb')::bigint) * 1024 * 1024 * 1024;
  used := public.storage_used_bytes(v);
  return jsonb_build_object('ok', used + greatest(coalesce(p_bytes, 0), 0) <= cap,
                            'tier', t, 'used', used, 'limit', cap);
end;
$$;

-- Everything the app needs to show plan status and usage.
create or replace function public.my_plan()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); t text; s public.subscriptions%rowtype; used int; oldest timestamptz;
begin
  if v is null then return null; end if;
  t := public.active_tier(v);
  select * into s from public.subscriptions where user_id = v;
  select count(*), min(created_at) into used, oldest
    from public.card_actions where user_id = v and created_at > now() - interval '24 hours';
  return jsonb_build_object(
    'tier', t,
    'status', coalesce(s.status, 'inactive'),
    'is_trial', coalesce(s.is_trial, false) and t <> 'free',
    'period_end', s.period_end,
    'will_renew', s.will_renew,
    'store', s.store,
    'limits', public.tier_limits(t),
    'actions_used', used,
    'actions_reset_at', case when oldest is null then null else oldest + interval '24 hours' end,
    'listings_active', public.active_listing_count(v),
    'rooms_owned', (select count(*) from public.rooms where creator_id = v),
    'storage_used', public.storage_used_bytes(v),
    'is_admin', public.has_role(v, 'admin'),
    'enforced', public.subscriptions_enforced()
  );
end;
$$;

revoke all on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;
revoke all on function public.can_upload(bigint) from public, anon;
grant execute on function public.can_upload(bigint) to authenticated;

-- ── Server-side enforcement (restrictive = must pass in addition to the
--    existing policies). Existing listings stay live; only new posts check.
do $$
declare t text;
begin
  foreach t in array array['bundles', 'skill_deals', 'service_requests', 'job_requests'] loop
    execute format('drop policy if exists "%1$s plan required" on public.%1$I', t);
    execute format('create policy "%1$s plan required" on public.%1$I as restrictive for insert to authenticated with check (public.can_post_listing(auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "rooms plan required" on public.rooms;
create policy "rooms plan required" on public.rooms as restrictive for insert to authenticated
  with check (public.can_create_room(auth.uid()));
