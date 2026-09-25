-- NBA best-of-5 series: each pairing plays up to 5 games, first to 3 advances.
-- Coin toss decides Player A (hosts G1/G3/G5); B hosts G2/G4. G5 only if 2-2.

-- Player A (homecourt holder) per series pairing
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS player_a_team TEXT;

-- Per-game results within a series
CREATE TABLE IF NOT EXISTS tournament_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES tournament_matches(match_id) ON DELETE CASCADE,
  tournament_type TEXT NOT NULL DEFAULT 'nba' CHECK (tournament_type IN ('nba','tekken')),
  game_number INT NOT NULL CHECK (game_number BETWEEN 1 AND 5),
  home_team TEXT,
  home_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner TEXT,
  winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed')),
  scheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (match_id, game_number)
);

CREATE INDEX IF NOT EXISTS idx_tournament_games_match ON tournament_games(match_id, game_number);
CREATE INDEX IF NOT EXISTS idx_tournament_games_type ON tournament_games(tournament_type);

ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_games' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON tournament_games FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
