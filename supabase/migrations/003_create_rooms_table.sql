-- Migration: Create rooms table (missing from initial schema)
-- Run this in Supabase SQL Editor

-- Rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  goal TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
  max_participants INTEGER DEFAULT 25,
  scheduled_date TIMESTAMPTZ,
  cover_image TEXT,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT NOT NULL,
  creator_avatar TEXT,
  participants JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'ended')),
  invite_link TEXT,
  presentation_state TEXT DEFAULT 'idle' CHECK (presentation_state IN ('idle', 'presenting', 'paused')),
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  presenter_name TEXT,
  presenter_tab TEXT,
  open_discussion BOOLEAN DEFAULT TRUE,
  environment TEXT DEFAULT 'generic',
  activity_log JSONB DEFAULT '[]'::jsonb,
  edit_indicators JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read rooms" ON public.rooms
  FOR SELECT USING (visibility = 'public' OR visibility = 'invite_only' OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = creator_id);

CREATE POLICY "Creator and hosts can update rooms" ON public.rooms
  FOR UPDATE USING (
    creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(participants) AS p
      WHERE p->>'userId' = auth.uid()::text
      AND (p->>'role' = 'host' OR p->>'role' = 'co_host')
    )
  );

CREATE POLICY "Creator can delete rooms" ON public.rooms
  FOR DELETE USING (creator_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_creator_id ON public.rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- Enable Realtime (for live collaboration)
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
