-- Migration 006: User Media Storage
-- Creates a public storage bucket for post, story, and avatar images
-- These are user-facing images that should be publicly readable

-- 1. Create the user-media bucket (public, image-only)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'user-media',
    'user-media',
    true,             -- public bucket — images are served via CDN
    10485760,         -- 10 MB max per file
    '{"image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif"}'
  );
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- 2. Storage policies
-- Allow authenticated users to upload to their own user folder
CREATE POLICY "User media: authenticated insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-media');

-- Allow public read access (images are served via CDN)
CREATE POLICY "User media: public select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'user-media');

-- Allow public/anonymous read access for CDN serving
CREATE POLICY "User media: public anon select" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'user-media');

-- Only owner can update their files
CREATE POLICY "User media: owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'user-media' AND owner = auth.uid());

-- Only owner can delete their files
CREATE POLICY "User media: owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'user-media' AND owner = auth.uid());

-- 3. Add an index for efficient user-folder queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_user_media_name
ON storage.objects (bucket_id, name);
