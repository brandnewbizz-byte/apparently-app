-- PENDING SQL — needs to be run once Direct Connections is enabled in Supabase
-- Run these in Supabase SQL Editor: https://supabase.com/dashboard/project/inejlmksbzujgpwvnnch/sql/new

-- Reports table (for post reports)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  reported_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending'
);

-- Hidden posts table (for hiding posts per user)
CREATE TABLE IF NOT EXISTS public.hidden_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- RLS: Users can create their own reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

-- RLS: Users can hide posts for themselves
ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can hide posts for themselves" ON public.hidden_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see their own hidden posts" ON public.hidden_posts
  FOR SELECT USING (auth.uid() = user_id);
