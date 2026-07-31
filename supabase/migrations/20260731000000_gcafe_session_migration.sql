-- GAMEPOINT session management (replaces GCafeTimer)
-- Adds gfunds balance, session status/station fields, and stations table.

-- 1. users: gfunds (peso balance)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gfunds INTEGER NOT NULL DEFAULT 0;

-- 2. sessions: station + status columns (table may have been created manually)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  user_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS station_name TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS points_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gfunds_used INTEGER NOT NULL DEFAULT 0;

-- 3. stations (cafe PCs)
CREATE TABLE IF NOT EXISTS stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  agent_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS (permissive — access control in service layer, same as users table)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON stations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
