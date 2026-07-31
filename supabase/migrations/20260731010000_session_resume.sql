-- GAMEPOINT session resume
-- Adds a per-session "paused" counter so leftover time survives a logout
-- and can be auto-resumed on any PC when the user logs back in.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS resume_seconds INTEGER NOT NULL DEFAULT 0;
