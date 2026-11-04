-- Live updates (Instagram-style): likes, stories, follows, marketplace listings,
-- requests, grabs and payment requests stream to the app.
do $$
declare t text;
begin
  foreach t in array array['post_likes','stories','follows','bundles','skill_deals','service_requests','job_requests','user_grabs','payment_requests'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
alter table public.post_likes replica identity full;
alter table public.follows replica identity full;
