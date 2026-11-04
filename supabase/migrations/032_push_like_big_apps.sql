-- Push notifications that behave like the big apps:
--  * calls ring on their own channel (Answer / Decline buttons, ~25 s ringtone,
--    high priority, expire when the call can't be answered any more)
--  * messages and activity use their own Android channels
--  * the app badge shows the real unread count
--  * every push carries what the app needs to open the right screen

create or replace function public.dispatch_push(p_recipient uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_kind text := coalesce(p_data->>'kind', 'notification');
  v_badge int := 1;
  v_msg jsonb;
begin
  select push_token into v_token from public.profiles where id = p_recipient limit 1;
  if v_token is null or v_token = '' then
    return; -- no token = never registered push / signed out; not an error
  end if;

  begin
    select
      (select count(*) from public.notifications where user_id = p_recipient and read = false)
      + (select count(*) from public.messages where receiver_id = p_recipient and read = false)
      into v_badge;
  exception when others then
    v_badge := 1;
  end;

  v_msg := jsonb_build_object(
    'to', v_token,
    'title', p_title,
    'body', p_body,
    'data', jsonb_build_object('kind', v_kind) || coalesce(p_data, '{}'::jsonb),
    'badge', greatest(v_badge, 1),
    'priority', 'high'
  );

  if v_kind = 'call' then
    v_msg := v_msg || jsonb_build_object(
      'sound', 'ringtone.wav',
      'channelId', 'incoming_calls',
      'categoryId', 'incoming_call',
      'ttl', 45,
      'interruptionLevel', 'time-sensitive'
    );
  elsif v_kind = 'message' then
    v_msg := v_msg || jsonb_build_object('sound', 'default', 'channelId', 'messages');
  else
    v_msg := v_msg || jsonb_build_object('sound', 'default', 'channelId', 'default');
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_msg
  );
end;
$$;

create or replace function public.notify_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_call boolean := new.type in ('call', 'call_request');
begin
  if new.user_id is not null
     and (new.actor_id is null or new.actor_id <> new.user_id)
     and public.push_enabled_for(new.user_id, new.type) then
    perform public.dispatch_push(
      new.user_id,
      coalesce(new.title, 'New notification'),
      coalesce(new.body, ''),
      coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
        'kind', case when v_is_call then 'call' else coalesce(new.data->>'kind', 'notification') end,
        'type', new.type,
        'notificationId', new.id,
        'actor_id', new.actor_id,
        'createdAt', coalesce(new.created_at, now())
      )
    );
  end if;
  return new;
end;
$$;
