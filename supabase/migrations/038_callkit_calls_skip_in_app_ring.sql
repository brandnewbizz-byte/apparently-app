-- iPhones that ring through CallKit (have a VoIP token): save the call
-- notification as already read, so the app doesn't ALSO open its own ringing
-- screen a few seconds later (in app 1.1.2 answering from that screen could
-- fail to connect). The VoIP push / CallKit screen is the one that rings.
create or replace function public.call_notification_callkit_read()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type in ('call', 'call_request') and exists (
    select 1 from public.profiles p where p.id = new.user_id and coalesce(p.voip_token, '') <> ''
  ) then
    new.read := true;
  end if;
  return new;
end;
$$;

create trigger trg_call_notification_callkit_read
  before insert on public.notifications
  for each row execute function public.call_notification_callkit_read();
