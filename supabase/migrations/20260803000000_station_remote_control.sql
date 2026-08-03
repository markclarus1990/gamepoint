-- Remote control of stations from the admin panel.
-- The agent polls for input events (SendInput) while remote_control is true.

alter table stations
  add column if not exists remote_control boolean default false,
  add column if not exists controlled_at timestamptz;

create table if not exists station_control_events (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_station_control_events_station
  on station_control_events (station_id, created_at);

alter table station_control_events enable row level security;

create policy "Service-layer access control" on station_control_events
  for all using (true) with check (true);
