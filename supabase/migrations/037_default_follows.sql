-- House pages everyone follows: every new member automatically follows the
-- accounts listed in app_default_follows (Daily Tea, Breaking News Network),
-- and everyone already on Apparently follows them now. People can still
-- unfollow. Server-side only, so no app update is needed.

create table if not exists public.app_default_follows (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.app_default_follows enable row level security;

insert into public.app_default_follows (account_id) values
  ('dec6bdc0-2038-4de5-96e0-f1bf5bba5c6e'), -- Daily Tea (@dailytea)
  ('cf303807-8ed2-4c64-8d90-6063a4373e81')  -- Breaking News Network (@breakingnewsnetwork)
on conflict do nothing;

create or replace function public.follow_default_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.follows (follower_id, following_id, status)
  select new.id, d.account_id, 'accepted'
  from public.app_default_follows d
  where d.account_id <> new.id
  on conflict (follower_id, following_id) do nothing;
  return new;
exception when others then
  return new; -- never block a sign-up over this
end;
$$;

drop trigger if exists trg_follow_default_accounts on public.profiles;
create trigger trg_follow_default_accounts
  after insert on public.profiles
  for each row execute function public.follow_default_accounts();

-- Everyone already here.
insert into public.follows (follower_id, following_id, status)
select p.id, d.account_id, 'accepted'
from public.profiles p cross join public.app_default_follows d
where p.id <> d.account_id
on conflict (follower_id, following_id) do nothing;
