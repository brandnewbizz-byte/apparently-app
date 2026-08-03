-- Migration 009: Avatar Storage Bucket
-- Creates a dedicated public storage bucket for user profile pictures
-- Fix: The settings page uploads to 'avatars' bucket but it never existed

-- 1. Create the avatars bucket (public, image-only, 5MB limit)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'avatars',
    'avatars',
    true,             -- public bucket — profile pics served via CDN
    5242880,          -- 5 MB max per avatar
    '{"image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif"}'
  );
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- 2. Storage RLS policies for avatars bucket

-- Allow authenticated users to upload avatars
CREATE POLICY "Avatars: authenticated insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow public read access (profile pics are served via CDN to everyone)
CREATE POLICY "Avatars: public select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

-- Allow anon/public read access for unauthenticated CDN serving
CREATE POLICY "Avatars: anon select" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'avatars');

-- Only the owner can update their own avatar files
CREATE POLICY "Avatars: owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());

-- Only the owner can delete their own avatar files
CREATE POLICY "Avatars: owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());

-- 3. Index for efficient avatar lookups
CREATE INDEX IF NOT EXISTS idx_storage_objects_avatars_name
ON storage.objects (bucket_id, name);
