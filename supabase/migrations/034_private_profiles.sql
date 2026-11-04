-- Private profiles (Instagram-style).
--  * profiles.is_private: only approved followers see the person's posts and
--    stories, and only they (or people the person follows / trades with) can
--    message them.
--  * Following a private account makes a follow REQUEST (follows.status =
--    'pending') that the owner approves or declines.
--  * Bundles, skill deals and other marketplace listings are NOT affected:
--    they stay public on Home and on their cards.

alter table public.profiles add column if not exists is_private boolean not null default false;

alter table public.follows add column if not exists status text not null default 'accepted';
do $$ begin
  alter table public.follows add constraint follows_status_check check (status in ('accepted', 'pending'));
exception when duplicate_object then null; end $$;

-- A follow of a private account always starts as a request (can't be skipped).
create or replace function public.follows_set_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = new.following_id and is_private)
     and new.follower_id <> new.following_id then
    new.status := 'pending';
  else
    new.status := 'accepted';
  end if;
  return new;
end $$;
create or replace trigger trg_follows_set_status before insert on public.follows
  for each row execute function public.follows_set_status();

-- Going public approves everyone who was waiting.
create or replace function public.profiles_private_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted' where following_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create or replace trigger trg_profiles_private_changed after update of is_private on public.profiles
  for each row execute function public.profiles_private_changed();

-- The account owner approves (pending → accepted) or removes followers / requests.
create policy "follows approve own" on public.follows for update
  using (following_id = auth.uid())
  with check (following_id = auth.uid() and status = 'accepted');
create policy "follows remove by owner" on public.follows for delete
  using (following_id = auth.uid());

-- Can the signed-in person see this owner's profile content?
create or replace function public.can_view_profile_content(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p_owner is null
    or p_owner = auth.uid()
    or not coalesce((select is_private from public.profiles where id = p_owner), false)
    or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p_owner and f.status = 'accepted')
    or public.has_role(auth.uid(), 'admin'::app_role);
$$;

alter policy "Anyone can view posts" on public.posts using (public.can_view_profile_content(user_id));
alter policy "Anyone can view stories" on public.stories using (public.can_view_profile_content(user_id));

-- Messaging a private account: approved followers, people they follow, and
-- anyone they trade with (grabs / orders) or who they've already written to.
create or replace function public.can_message(p_receiver uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p_receiver is null
    or p_receiver = auth.uid()
    or not coalesce((select is_private from public.profiles where id = p_receiver), false)
    or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p_receiver and f.status = 'accepted')
    or exists (select 1 from public.follows f where f.follower_id = p_receiver and f.following_id = auth.uid() and f.status = 'accepted')
    or exists (select 1 from public.user_grabs g where (g.user_id = auth.uid() and g.provider_id = p_receiver) or (g.user_id = p_receiver and g.provider_id = auth.uid()))
    or exists (select 1 from public.messages m where m.sender_id = p_receiver and m.receiver_id = auth.uid());
$$;

create policy "messages private accounts" on public.messages as restrictive for insert
  with check (public.can_message(receiver_id));

-- Follow requests use notification type 'follow' with data.kind = 'follow_request'.
