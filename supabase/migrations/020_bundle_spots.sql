-- 020 — Bundle spots
-- The creator chooses how many people can grab a bundle (default 1).
-- Once that many people have grabbed it, the bundle is marked 'grabbed'
-- and drops out of everyone's discovery feed.

alter table public.bundles
  add column if not exists available_count integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bundles_available_count_positive') then
    alter table public.bundles
      add constraint bundles_available_count_positive check (available_count >= 1);
  end if;
end $$;

-- Atomically claim one spot. Locks the bundle row so two people can't take
-- the last spot at the same time. Returns { ok, reason?, grabs, available_count, spots_left }.
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

  if exists (
    select 1 from public.user_grabs
    where user_id = v and item_id = p_bundle::text and item_type = 'bundle'
      and coalesce(status, '') <> 'cancelled'
  ) then
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
        status = case when new_grabs >= b.available_count then 'grabbed' else status end,
        updated_at = now()
    where id = p_bundle;

  return jsonb_build_object('ok', true, 'grabs', new_grabs,
    'available_count', b.available_count,
    'spots_left', greatest(b.available_count - new_grabs, 0));
end;
$$;
revoke all on function public.grab_bundle(uuid) from public, anon;
grant execute on function public.grab_bundle(uuid) to authenticated;
