-- Station screen captures
alter table stations
  add column if not exists screenshot_url text,
  add column if not exists screenshot_at timestamptz;

-- Public bucket for latest screenshot per station (upsert overwrites)
insert into storage.buckets (id, name, public)
values ('station-shots', 'station-shots', true)
on conflict (id) do nothing;

create policy "station-shots public read"
  on storage.objects for select
  using (bucket_id = 'station-shots');

create policy "station-shots anon insert"
  on storage.objects for insert
  with check (bucket_id = 'station-shots');
