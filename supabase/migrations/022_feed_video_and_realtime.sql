-- 022: Feed fixes
-- 1) Video posts: the user-media bucket only accepted images up to 10 MB, so
--    every video upload was rejected and the post saved a phone-only file://
--    path. Allow common video types and raise the limit to 100 MB.
update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'video/mp4','video/quicktime','video/x-m4v','video/webm','video/3gpp'
  ]
where id = 'user-media';

-- 2) Live feed: publish posts inserts/deletes so new posts appear without a
--    manual refresh (SocialContext subscribes to the 'feed-posts' channel).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;
