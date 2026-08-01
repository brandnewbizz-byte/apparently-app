-- =============================================
-- Supabase Migration: activity_log + rooms upgrade
-- Run this in your Supabase SQL Editor
-- =============================================

-- Add activity_log column to rooms table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'activity_log'
  ) THEN
    ALTER TABLE rooms ADD COLUMN activity_log JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add edit_indicators column to rooms table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'edit_indicators'
  ) THEN
    ALTER TABLE rooms ADD COLUMN edit_indicators JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add presentation_state column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'presentation_state'
  ) THEN
    ALTER TABLE rooms ADD COLUMN presentation_state TEXT DEFAULT 'idle';
  END IF;
END $$;

-- Add presenter_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'presenter_id'
  ) THEN
    ALTER TABLE rooms ADD COLUMN presenter_id UUID;
  END IF;
END $$;

-- Add presenter_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'presenter_name'
  ) THEN
    ALTER TABLE rooms ADD COLUMN presenter_name TEXT;
  END IF;
END $$;

-- Add open_discussion column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'open_discussion'
  ) THEN
    ALTER TABLE rooms ADD COLUMN open_discussion BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- =============================================
-- Room History Table (dedicated, for fast queries)
-- =============================================
CREATE TABLE IF NOT EXISTS room_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  user_id UUID,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Index for fast room history lookups
CREATE INDEX IF NOT EXISTS idx_room_history_room_id ON room_history(room_id);
CREATE INDEX IF NOT EXISTS idx_room_history_created_at ON room_history(created_at DESC);

-- =============================================
-- Real-time sync table for plan edits
-- =============================================
CREATE TABLE IF NOT EXISTS plan_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL,
  room_id UUID,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  section TEXT NOT NULL,
  data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_plan_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_sync_plan_id ON plan_sync(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_sync_room_id ON plan_sync(room_id);

-- =============================================
-- Enable Realtime for rooms and plan_sync
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE plan_sync;

-- =============================================
-- Function: log room history
-- =============================================
CREATE OR REPLACE FUNCTION log_room_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when activity_log changes
  IF TG_OP = 'UPDATE' AND NEW.activity_log IS DISTINCT FROM OLD.activity_log THEN
    INSERT INTO room_history (room_id, user_id, user_name, action, detail)
    SELECT
      NEW.id,
      (entry->>'userId')::UUID,
      entry->>'userName',
      entry->>'action',
      entry->>'detail'
    FROM jsonb_array_elements(NEW.activity_log) AS entry
    WHERE entry->>'id' NOT IN (
      SELECT entry2->>'id'
      FROM jsonb_array_elements(COALESCE(OLD.activity_log, '[]'::jsonb)) AS entry2
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on rooms table
DROP TRIGGER IF EXISTS trg_room_history ON rooms;
CREATE TRIGGER trg_room_history
  AFTER UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION log_room_history();

-- =============================================
-- RLS Policies for room_history
-- =============================================
ALTER TABLE room_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view room history for their rooms" ON room_history;
CREATE POLICY "Users can view room history for their rooms"
  ON room_history FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM rooms WHERE
        creator_id = auth.uid()
        OR participants::jsonb @> to_jsonb(auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert history" ON room_history;
CREATE POLICY "Authenticated users can insert history"
  ON room_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- RLS Policies for plan_sync
-- =============================================
ALTER TABLE plan_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read plan sync for their plans" ON plan_sync;
CREATE POLICY "Users can read plan sync for their plans"
  ON plan_sync FOR SELECT
  USING (TRUE); -- Public read for plans

DROP POLICY IF EXISTS "Authenticated users can insert plan sync" ON plan_sync;
CREATE POLICY "Authenticated users can insert plan sync"
  ON plan_sync FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own plan sync" ON plan_sync;
CREATE POLICY "Users can update their own plan sync"
  ON plan_sync FOR UPDATE
  USING (auth.uid() = user_id);
