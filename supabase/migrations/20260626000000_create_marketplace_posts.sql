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

-- Enable row-level security
ALTER TABLE marketplace_posts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Anyone can read marketplace_posts"
  ON marketplace_posts
  FOR SELECT
  USING (true);

-- Allow users to insert their own posts
CREATE POLICY "Users can create their own posts"
  ON marketplace_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow owners to update their posts
CREATE POLICY "Owners can update their posts"
  ON marketplace_posts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow owners to delete their posts
CREATE POLICY "Owners can delete their posts"
  ON marketplace_posts
  FOR DELETE
  USING (auth.uid() = user_id);
