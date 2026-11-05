-- iPhone calls ring like WhatsApp (CallKit + VoIP push).
--
-- Each iPhone saves a VoIP token (private, like push_token). When someone is
-- called and their phone has one, the call goes out as a VoIP push through the
-- voip-push edge function, which wakes the app even when it's closed or the
-- phone is locked. If that can't be sent (Apple key not set up yet, old app,
-- bad token) the function falls back to the normal call notification.

alter table public.profiles add column if not exists voip_token text;
alter table public.profiles add column if not exists voip_token_updated_at timestamptz;
grant update (voip_token, voip_token_updated_at) on public.profiles to authenticated;

-- One VoIP push per call notification.
create table if not exists public.voip_push_log (
  notification_id uuid primary key,
  sent_at timestamptz not null default now(),
  result text
);
alter table public.voip_push_log enable row level security;

create or replace function public.dispatch_push(p_recipient uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_voip text;
  v_kind text := coalesce(p_data->>'kind', 'notification');
  v_badge int := 1;
  v_msg jsonb;
begin
  select push_token, voip_token into v_token, v_voip from public.profiles where id = p_recipient limit 1;

  -- iPhone with CallKit: the edge function sends the VoIP push (or falls back).
  if v_kind = 'call' and coalesce(v_voip, '') <> '' and coalesce(p_data->>'notificationId', '') <> '' then
    perform net.http_post(
      url := 'https://inejlmksbzujgpwvnnch.supabase.co/functions/v1/voip-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('notificationId', p_data->>'notificationId')
    );
    return;
  end if;

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
