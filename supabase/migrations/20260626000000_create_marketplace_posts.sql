CREATE TABLE IF NOT EXISTS marketplace_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_amount INTEGER NOT NULL CHECK (points_amount > 0),
  asking_price INTEGER NOT NULL CHECK (asking_price > 0),
  payment_method TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_posts_user_id ON marketplace_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_posts_status ON marketplace_posts(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_posts_created_at ON marketplace_posts(created_at DESC);

-- Access control is enforced at the service layer (project convention).
-- RLS is enabled with permissive policies since server-side code uses
-- the anon key without auth context (auth.uid() is always null).
ALTER TABLE marketplace_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-layer access control"
  ON marketplace_posts
  FOR ALL
  USING (true)
  WITH CHECK (true);
