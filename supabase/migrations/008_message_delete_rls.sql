-- 008: RLS policies for message + conversation delete
-- Allows authenticated users to delete their own messages and conversations

-- Allow users to delete messages they sent OR received
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Allow users to delete conversations they're part of
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (
    auth.uid() = participant_one OR auth.uid() = participant_two
  );
