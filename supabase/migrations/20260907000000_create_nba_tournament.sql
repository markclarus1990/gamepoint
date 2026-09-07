-- NBA Tournament: 1 player = 1 team, first-come gets fav team, 16 max, auto-start on 16
-- Isolated from Tekken via tournament_type discriminator

-- tournament_registrations: stores NBA + Tekken registrations with type
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team TEXT,
  tournament_type TEXT NOT NULL DEFAULT 'nba' CHECK (tournament_type IN ('nba','tekken')),
  conference TEXT CHECK (conference IN ('East','West')),
  division TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tournament_type, user_id),
  UNIQUE (tournament_type, team)
);

-- Ensure team not null for NBA
-- Backwards compat: tekken rows may have team null

CREATE INDEX IF NOT EXISTS idx_tournament_registrations_type ON tournament_registrations(tournament_type, created_at);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_user ON tournament_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_team ON tournament_registrations(team);

-- tournament_matches: persisted bracket matches, auto-generated on 16th registration
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  tournament_type TEXT NOT NULL DEFAULT 'nba' CHECK (tournament_type IN ('nba','tekken')),
  round TEXT NOT NULL CHECK (round IN ('First Round','Semifinals','Conference Finals','Finals')),
  conference TEXT CHECK (conference IN ('East','West')),
  seed1 INT,
  seed2 INT,
  team1 TEXT,
  team2 TEXT,
  team1_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team2_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner TEXT,
  winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  loser TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed')),
  scheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_type_round ON tournament_matches(tournament_type, round, conference);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_match_id ON tournament_matches(match_id);

ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_registrations' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON tournament_registrations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_matches' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON tournament_matches FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- If tables pre-existed without tournament_type, backfill
DO $$
BEGIN
  -- only backfill if column exists and has nulls
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournament_registrations' AND column_name='tournament_type') THEN
    UPDATE tournament_registrations SET tournament_type = CASE WHEN team IS NOT NULL THEN 'nba' ELSE 'tekken' END WHERE tournament_type IS NULL;
  END IF;
END $$;
