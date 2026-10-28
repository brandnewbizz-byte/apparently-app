-- Planner help requests (chauffeur / assistant / errands / delivery) + grab dedupe.
--
-- 'pending' is the open state (job_requests_status_check doesn't allow 'open'),
-- but the accept policy required status = 'open', so no helper could ever take
-- a job. Point it at 'pending' and add an atomic accept function.

drop policy if exists "job_requests accept open" on public.job_requests;
create policy "job_requests accept open" on public.job_requests for update
  using (status = 'pending' and accepted_by is null and user_id <> auth.uid() and not is_user_blocked())
  with check (accepted_by = auth.uid() and not is_user_blocked());

create or replace function public.accept_job_request(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.job_requests%rowtype;
  v_name text;
  v_avatar text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if public.is_user_blocked() then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  select * into v_job from public.job_requests where id = p_job for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_job.user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own_request');
  end if;
  if v_job.accepted_by is not null or v_job.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', case when v_job.accepted_by = v_uid then 'already_grabbed' else 'taken' end);
  end if;

  select coalesce(full_name, username, 'Helper'), coalesce(avatar, '') into v_name, v_avatar
  from public.profiles where id = v_uid;

  update public.job_requests
     set status = 'accepted', accepted_by = v_uid, accepted_by_name = v_name,
         accepted_by_avatar = v_avatar, updated_at = now()
   where id = p_job;

  return jsonb_build_object('ok', true, 'owner_id', v_job.user_id);
end;
$$;

revoke all on function public.accept_job_request(uuid) from public, anon;
grant execute on function public.accept_job_request(uuid) to authenticated;

-- One grab per person per item (skills / requests had no guard).
create unique index if not exists user_grabs_one_per_item
  on public.user_grabs (user_id, item_type, item_id);

create index if not exists job_requests_open_idx
  on public.job_requests (created_at desc) where status = 'pending' and accepted_by is null;
