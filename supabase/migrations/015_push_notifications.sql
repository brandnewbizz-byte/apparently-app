-- supabase/migrations/015_push_notifications.sql
--
-- Self-contained OS push wiring: when a new `notifications` or `messages` row is
-- inserted, a Postgres trigger looks up the recipient's `profiles.push_token`
-- and POSTs directly to Expo's push service via `pg_net`. No edge function or
-- external secret required.
--
-- Requires the `pg_net` extension (enabled below).

begin;

-- ── 1. Enable pg_net (async HTTP from within Postgres) ────────────────
create extension if not exists pg_net;

-- ── 2. Dispatch helper: resolve recipient token + POST to Expo ─────────
create or replace function public.dispatch_push(
  p_recipient uuid,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- Resolve the recipient's current push token.
  select push_token
    into v_token
    from public.profiles
    where id = p_recipient
    limit 1;

  if v_token is null or v_token = '' then
    return; -- no token = never registered push / signed out; not an error
  end if;

  -- POST straight to Expo's push service (the token is the delivery address).
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'to', v_token,
      'sound', 'default',
      'title', p_title,
      'body', p_body,
      'data', jsonb_build_object('kind', coalesce(p_data->>'kind', 'notification')) || coalesce(p_data, '{}'::jsonb),
      'badge', 1
    )
  );
end;
$$;

-- ── 3. Trigger on notifications ────────────────────────────────────────
create or replace function public.notify_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and (new.actor_id is null or new.actor_id <> new.user_id) then
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

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row
  execute function public.notify_on_notification_insert();

-- ── 4. Trigger on messages ─────────────────────────────────────────────
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
     and (new.sender_id is null or new.sender_id <> new.receiver_id) then
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

drop trigger if exists trg_messages_push on public.messages;
create trigger trg_messages_push
  after insert on public.messages
  for each row
  execute function public.notify_on_message_insert();

commit;
