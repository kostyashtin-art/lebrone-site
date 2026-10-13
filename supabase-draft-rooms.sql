-- Dota Draft Training: room table for the draft simulator.
-- The policies below are intentionally permissive for initial testing only.
-- Anyone who knows the public anon/publishable key can read and update room data.
-- Before public launch, implement authenticated room membership and server-side turn validation.

create table if not exists public.draft_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_name text not null,
  state jsonb not null default '{"actions":[],"status":"draft"}'::jsonb,
  status text not null default 'draft' check (status in ('draft','complete')),
  created_at timestamptz not null default now()
);

alter table public.draft_rooms enable row level security;

drop policy if exists "draft rooms public insert" on public.draft_rooms;
create policy "draft rooms public insert" on public.draft_rooms
for insert to anon, authenticated with check (true);

drop policy if exists "draft rooms public read" on public.draft_rooms;
create policy "draft rooms public read" on public.draft_rooms
for select to anon, authenticated using (true);

drop policy if exists "draft rooms public update" on public.draft_rooms;
create policy "draft rooms public update" on public.draft_rooms
for update to anon, authenticated using (true) with check (true);

-- Enable draft_rooms under Supabase Database > Replication / Realtime only if you
-- later switch this page from polling to Supabase Realtime. Current MVP polls every ~1.8s.
