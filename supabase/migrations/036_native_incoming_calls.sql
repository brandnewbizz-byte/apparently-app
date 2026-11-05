-- Incoming calls that ring outside the app, like WhatsApp.
--
--  * iPhone: calls go out as VoIP pushes (PushKit) to the device's VoIP token,
--    so they ring on the system call screen (CallKit) even when the app is
--    closed or the phone is locked. Sent by the `send-voip` edge function
--    (APNs needs HTTP/2, which pg_net can't do). If that fails, it falls back
--    to the regular Expo push, so nobody gets less than today.
--  * Android: unchanged on the server — the new app build turns the regular
--    call push into a full-screen ringing call notification itself.
--  * cancel_call(): the caller hung up before you answered → the ringing
--    stops on your phone too (lock screen / notification), not just in the app.
--
-- Safe to apply before the new app builds ship: nothing changes until a
-- device saves a VoIP token, and old app versions ignore `call_cancel` pushes.

begin;

alter table public.profiles
  add column if not exists voip_token text,
  add column if not exists voip_token_updated_at timestamptz;

-- Private like push_token: the owner can write it, nobody can read it from the client.
grant update (voip_token, voip_token_updated_at) on public.profiles to authenticated;

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
  v_secret text;
begin
  select push_token, voip_token into v_token, v_voip from public.profiles where id = p_recipient limit 1;
  if v_token = '' then v_token := null; end if;
  if v_voip = '' then v_voip := null; end if;

  -- The caller hung up before it was answered: stop the ringing.
  if v_kind = 'call_cancel' then
    -- iPhones with the system call screen stop it themselves (the app is woken by the call).
    if v_voip is not null or v_token is null then return; end if;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'to', v_token,
        'data', p_data,
        'priority', 'high',
        'ttl', 60,
        '_contentAvailable', true
      )
    );
    return;
  end if;

  if v_token is null and not (v_kind = 'call' and v_voip is not null) then
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

  if v_token is not null then
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
  end if;

  -- iPhone with the system call screen: VoIP push (regular push as the fallback).
  if v_kind = 'call' and v_voip is not null then
    begin
      select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'send_push_secret' limit 1;
    exception when others then
      v_secret := null;
    end;
    perform net.http_post(
      url := 'https://inejlmksbzujgpwvnnch.supabase.co/functions/v1/send-voip',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-send-push-secret', coalesce(v_secret, '')),
      body := jsonb_build_object(
        'recipientId', p_recipient,
        'voipToken', v_voip,
        'call', jsonb_build_object('kind', v_kind) || coalesce(p_data, '{}'::jsonb),
        'fallback', v_msg
      )
    );
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_msg
  );
end;
$$;

-- The caller gave up before the other person answered.
create or replace function public.cancel_call(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null or coalesce(p_room_id, '') = '' then
    return;
  end if;
  for r in
    update public.notifications
       set read = true
     where actor_id = auth.uid()
       and type in ('call', 'call_request')
       and read = false
       and data->>'room_id' = p_room_id
    returning user_id
  loop
    perform public.dispatch_push(r.user_id, '', '', jsonb_build_object('kind', 'call_cancel', 'room_id', p_room_id));
  end loop;
end;
$$;

revoke all on function public.cancel_call(text) from public, anon;
grant execute on function public.cancel_call(text) to authenticated;

commit;
