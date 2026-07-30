-- Create reports table for post reporting
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hidden_posts table for hiding posts
CREATE TABLE IF NOT EXISTS hidden_posts (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
