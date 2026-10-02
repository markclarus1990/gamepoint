-- Efficient leaderboard: aggregate in Postgres instead of fetching all sessions.
-- Saves Supabase egress/rows-read: Top-5 becomes 1 tiny 5-row query (cached 10 min
-- at the API layer) + on-demand single-player lookup, instead of full-table scans.

-- Index to speed up GROUP BY user_name aggregation
CREATE INDEX IF NOT EXISTS idx_sessions_user_name_minutes ON sessions(user_name, minutes);

-- Top-N leaderboard (excludes test accounts, same list as LeaderboardService)
CREATE OR REPLACE FUNCTION get_leaderboard_top(limit_n INT DEFAULT 5)
RETURNS TABLE (name TEXT, total_minutes BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT s.user_name AS name, SUM(s.minutes)::BIGINT AS total_minutes
  FROM sessions s
  WHERE lower(trim(s.user_name)) NOT IN ('test', 'test2', 'test3', 'test4', 'test5')
  GROUP BY s.user_name
  ORDER BY SUM(s.minutes) DESC
  LIMIT limit_n;
$$;

-- Single-player stats + rank (1-based). Returns 0 rows when player has no sessions.
CREATE OR REPLACE FUNCTION get_player_rank(p_name TEXT)
RETURNS TABLE (name TEXT, total_minutes BIGINT, rank BIGINT)
LANGUAGE sql STABLE
AS $$
  WITH totals AS (
    SELECT s.user_name AS uname, SUM(s.minutes)::BIGINT AS total
    FROM sessions s
    WHERE lower(trim(s.user_name)) NOT IN ('test', 'test2', 'test3', 'test4', 'test5')
    GROUP BY s.user_name
  ),
  target AS (
    SELECT t.uname, t.total
    FROM totals t
    WHERE lower(t.uname) = lower(trim(p_name))
    LIMIT 1
  )
  SELECT target.uname AS name, target.total AS total_minutes,
         ((SELECT COUNT(*) FROM totals WHERE totals.total > target.total) + 1)::BIGINT AS rank
  FROM target;
$$;
