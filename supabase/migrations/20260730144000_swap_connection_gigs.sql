-- swap_posts: swap marketplace listings
CREATE TABLE IF NOT EXISTS swap_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  images TEXT[],
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- swap_matches: matches between swap posts
CREATE TABLE IF NOT EXISTS swap_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  swap_post_id UUID REFERENCES swap_posts(id),
  matched_user_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- connection_requests: friend/connection requests
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  target_user_id UUID,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- my_active_gigs: view of active gigs only
CREATE OR REPLACE VIEW my_active_gigs AS
  SELECT * FROM gigs
  WHERE status NOT IN ('closed', 'fulfilled', 'cancelled');
