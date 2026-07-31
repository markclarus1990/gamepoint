-- GAMEPOINT fix: allow 'paused' session status
-- The sessions table was created before the resume feature, so its status
-- CHECK constraint rejects 'paused' and every pause (logout save) fails
-- with sessions_status_check violation.

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'expired'));
