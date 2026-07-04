-- Add GitHub OAuth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;

CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
