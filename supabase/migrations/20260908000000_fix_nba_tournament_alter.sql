-- Fix 42703: retrofit missing columns if tournament_registrations/tournament_matches pre-existed
-- 20260907 used CREATE TABLE IF NOT EXISTS (no-op if table exists) — this adds the ALTERs
-- Expected columns: register:167, bracket/players, types/index.ts:307, lib/constants/nba.ts

-- tournament_registrations — add all NBA columns expected by code
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS team TEXT;
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'nba';
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS conference TEXT;
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS division TEXT;

-- constraints (idempotent)
DO $$ BEGIN
  ALTER TABLE tournament_registrations ADD CONSTRAINT chk_reg_tourn_type CHECK (tournament_type IN ('nba','tekken'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE tournament_registrations ADD CONSTRAINT chk_reg_conference CHECK (conference IN ('East','West'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_reg_type_user') THEN
    ALTER TABLE tournament_registrations ADD CONSTRAINT uq_reg_type_user UNIQUE (tournament_type, user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_reg_type_team') THEN
    ALTER TABLE tournament_registrations ADD CONSTRAINT uq_reg_type_team UNIQUE (tournament_type, team);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reg_type_created ON tournament_registrations(tournament_type, created_at);
CREATE INDEX IF NOT EXISTS idx_reg_team ON tournament_registrations(team);
CREATE INDEX IF NOT EXISTS idx_reg_user ON tournament_registrations(user_id);

-- backfill existing rows (preserve Tekken: team IS NULL => tekken, else nba)
UPDATE tournament_registrations SET tournament_type = CASE WHEN team IS NOT NULL THEN 'nba' ELSE 'tekken' END WHERE tournament_type IS NULL;
-- ensure defaults for future inserts
ALTER TABLE tournament_registrations ALTER COLUMN tournament_type SET DEFAULT 'nba';

-- tournament_matches — ensure full table (register:48-62, matches:24-34 need 16 cols)
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  tournament_type TEXT NOT NULL DEFAULT 'nba' CHECK (tournament_type IN ('nba','tekken')),
  round TEXT NOT NULL CHECK (round IN ('First Round','Semifinals','Conference Finals','Finals')),
  conference TEXT CHECK (conference IN ('East','West')),
  seed1 INT, seed2 INT, team1 TEXT, team2 TEXT,
  team1_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team2_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner TEXT, winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL, loser TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed')),
  scheduled_date TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

-- If tournament_matches pre-existed with partial schema, retrofit missing columns
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'nba';
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS round TEXT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS conference TEXT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS seed1 INT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS seed2 INT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS team1 TEXT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS team2 TEXT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS team1_user_id UUID;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS team2_user_id UUID;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS winner TEXT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS winner_user_id UUID;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS loser TEXT;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$ BEGIN
  ALTER TABLE tournament_matches ADD CONSTRAINT chk_matches_tourn_type CHECK (tournament_type IN ('nba','tekken'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE tournament_matches ADD CONSTRAINT chk_matches_round CHECK (round IN ('First Round','Semifinals','Conference Finals','Finals'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE tournament_matches ADD CONSTRAINT chk_matches_conference CHECK (conference IN ('East','West'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE tournament_matches ADD CONSTRAINT chk_matches_status CHECK (status IN ('scheduled','completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_type_round ON tournament_matches(tournament_type, round, conference);
CREATE INDEX IF NOT EXISTS idx_matches_match_id ON tournament_matches(match_id);

-- RLS (idempotent)
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_registrations' AND policyname='Service-layer access control') THEN
    CREATE POLICY "Service-layer access control" ON tournament_registrations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_matches' AND policyname='Service-layer access control') THEN
    CREATE POLICY "Service-layer access control" ON tournament_matches FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
