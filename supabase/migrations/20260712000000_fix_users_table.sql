-- Create users table if missing (no migration in repo creates it)
-- Also ensures RLS is configured per project convention

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Columns added by later migrations (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;

-- RLS (permissive — access control in service layer)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
