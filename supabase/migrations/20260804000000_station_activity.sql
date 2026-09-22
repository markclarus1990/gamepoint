-- Live activity (foreground window / game) reported on-demand by the agent.
-- Written only when admin requests it (screenshot upload or activity command),
-- so there is no background Supabase write cost.
alter table stations
  add column if not exists current_window_title text,
  add column if not exists current_process text,
  add column if not exists activity_at timestamptz;
