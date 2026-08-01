-- Admin control: pending shutdown/restart command per station.
-- The agent picks it up on its next poll, acks (clears) it, then executes.

alter table stations
  add column if not exists command text,
  add column if not exists command_at timestamptz;
