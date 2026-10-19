-- supabase/migrations/016_message_delivered.sql
-- Adds a `delivered` flag so the sender can render ✓ (sent) / ✓✓ (delivered) / ✓✓ colored (read)
-- receipts. `read` already exists; `delivered` tracks whether the recipient's device
-- has received the message (set by the recipient's realtime INSERT handler).

begin;

alter table public.messages
  add column if not exists delivered boolean default false;

-- Backfill: any message already read was necessarily delivered.
update public.messages set delivered = true where read = true and delivered = false;

commit;
