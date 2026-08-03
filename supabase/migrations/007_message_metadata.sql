-- 007_message_metadata
-- Add JSONB metadata column to messages for rich card content (bundle/skill cards, etc.)

ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
