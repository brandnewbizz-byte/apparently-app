-- supabase/migrations/017_notification_prefs.sql
--
-- Per-user notification preferences. Adds a `notification_prefs` jsonb column
-- to profiles and teaches the push triggers (from 015) to respect it.
--
-- Pref shape (all optional; absence = enabled):
--   { "all": false, "messages": false, "like": false, "comment": false,
--     "mention": false, "follow": false }
--   - "all": false  → master off (no OS pushes at all)
--   - "<type>": false → mute that specific notification type
--   - messages uses the key "messages" (fired from the messages trigger)

begin;

alter table public.profiles
  add column if not exists notification_prefs jsonb default '{}'::jsonb;

-- ── Helper: is this push enabled for the user? ─────────────────────────
create or replace function public.push_enabled_for(
  p_user uuid,
  p_type text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((notification_prefs ->> 'all')::boolean, true)
    and coalesce((notification_prefs ->> p_type)::boolean, true)
  from public.profiles
  where id = p_user
  limit 1;
$$;

-- ── Notifications trigger: respect per-type prefs ───────────────────────
create or replace function public.notify_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and (new.actor_id is null or new.actor_id <> new.user_id)
     and public.push_enabled_for(new.user_id, new.type) then
    perform public.dispatch_push(
      new.user_id,
      coalesce(new.title, 'New notification'),
      coalesce(new.body, ''),
      coalesce(new.data, '{}'::jsonb)
    );
  end if;
  return new;
end;
$$;

-- ── Messages trigger: respect messages pref ─────────────────────────────
create or replace function public.notify_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_title text;
  v_body text;
begin
  if new.receiver_id is not null
     and (new.sender_id is null or new.sender_id <> new.receiver_id)
     and public.push_enabled_for(new.receiver_id, 'messages') then
    select coalesce(full_name, username, 'New message')
      into v_sender_name
      from public.profiles
      where id = new.sender_id
      limit 1;

    v_title := coalesce(v_sender_name, 'New message');

    if new.metadata ? 'voice_note' then
      v_body := '🎤 Voice note';
    elsif new.metadata ? 'image' then
      v_body := '📷 Photo';
    elsif new.content is not null and length(new.content) > 0 then
      v_body := new.content;
    else
      v_body := 'Sent you a message';
    end if;

    perform public.dispatch_push(
      new.receiver_id,
      v_title,
      v_body,
      jsonb_build_object(
        'kind', 'message',
        'conversationId', new.conversation_id,
        'senderId', new.sender_id
      )
    );
  end if;
  return new;
end;
$$;

commit;
