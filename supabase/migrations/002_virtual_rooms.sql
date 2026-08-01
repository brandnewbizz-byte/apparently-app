-- =============================================
-- Virtual Rooms Migration
-- =============================================
-- Adds virtual environments + shared objects to rooms.
-- Prepared for future marketplace features.

-- 1. Virtual Room Environments
CREATE TABLE IF NOT EXISTS virtual_room_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  environment_type TEXT NOT NULL DEFAULT 'generic',
  background_color TEXT DEFAULT '#FFFFFF',
  camera_x FLOAT DEFAULT 0,
  camera_y FLOAT DEFAULT 0,
  camera_scale FLOAT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vre_room ON virtual_room_environments(room_id);

-- 2. Virtual Room Objects
CREATE TABLE IF NOT EXISTS virtual_room_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL DEFAULT 'image',
  name TEXT,
  description TEXT,
  notes TEXT,
  image_url TEXT,
  -- Transform
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 100,
  height FLOAT NOT NULL DEFAULT 100,
  rotation FLOAT NOT NULL DEFAULT 0,
  scale FLOAT NOT NULL DEFAULT 1,
  z_index INT NOT NULL DEFAULT 0,
  -- Ownership
  owner_id UUID REFERENCES auth.users(id),
  owner_name TEXT,
  -- Extensible metadata bucket
  metadata JSONB DEFAULT '{}'::jsonb,
  -- ── Future marketplace fields (NOT built yet, schema only) ──
  price DECIMAL(10,2),
  is_listed BOOLEAN DEFAULT FALSE,
  sponsor_id UUID,
  reward_points INT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vro_room ON virtual_room_objects(room_id);
CREATE INDEX IF NOT EXISTS idx_vro_owner ON virtual_room_objects(owner_id);

-- 3. Enable Realtime (for sync)
ALTER PUBLICATION supabase_realtime ADD TABLE virtual_room_environments;
ALTER PUBLICATION supabase_realtime ADD TABLE virtual_room_objects;

-- 4. RLS Policies (same pattern as existing rooms)
ALTER TABLE virtual_room_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_room_objects ENABLE ROW LEVEL SECURITY;

-- Allow read to authenticated users
CREATE POLICY "Allow read virtual_room_environments"
  ON virtual_room_environments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read virtual_room_objects"
  ON virtual_room_objects FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert to authenticated users
CREATE POLICY "Allow insert virtual_room_environments"
  ON virtual_room_environments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow insert virtual_room_objects"
  ON virtual_room_objects FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow update/delete to owners or room admins
CREATE POLICY "Allow update virtual_room_environments"
  ON virtual_room_environments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow update virtual_room_objects"
  ON virtual_room_objects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete virtual_room_objects"
  ON virtual_room_objects FOR DELETE
  TO authenticated
  USING (true);
