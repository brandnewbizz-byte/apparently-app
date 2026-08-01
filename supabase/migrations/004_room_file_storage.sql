-- Migration 004: Room File Storage
-- Adds Supabase Storage bucket + policies + room-level quota tracking
-- 5 GB limit per room

-- 1. Create storage bucket for room files
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'room-files',
    'room-files',
    false,
    524288000, -- 500 MB max per file
    '{"image/*","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain","text/csv","application/zip","application/json","application/xml","video/mp4"}'
  );
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- 2. Storage policies
-- Allow authenticated users to upload to any room folder
CREATE POLICY "Room files: authenticated insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'room-files');

-- Allow authenticated users to read any room file
CREATE POLICY "Room files: authenticated select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'room-files');

-- Only file owner can delete their files
CREATE POLICY "Room files: owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'room-files' AND owner = auth.uid());

-- Allow file updates (e.g. metadata) by owner
CREATE POLICY "Room files: owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'room-files' AND owner = auth.uid());

-- 3. Room storage quota table (tracks bytes used per room)
CREATE TABLE IF NOT EXISTS public.room_storage_quota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL UNIQUE,
  bytes_used bigint NOT NULL DEFAULT 0,
  quota_limit bigint NOT NULL DEFAULT 5368709120, -- 5 GB
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for quota
ALTER TABLE public.room_storage_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quota: authenticated read" ON public.room_storage_quota
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Quota: authenticated insert" ON public.room_storage_quota
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Quota: authenticated update" ON public.room_storage_quota
FOR UPDATE TO authenticated USING (true);

-- Index on room_id
CREATE INDEX IF NOT EXISTS idx_room_storage_quota_room_id ON public.room_storage_quota(room_id);

-- Enable realtime for quota changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_storage_quota;
