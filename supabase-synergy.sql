-- 4T1J TEAM SYNERGY ANALYTICS
-- Run this file in Supabase SQL Editor after the main schema.

create table if not exists public.team_matches (
  match_id bigint primary key,
  start_time timestamptz,
  duration integer not null default 0,
  radiant_win boolean,
  game_mode integer,
  lobby_type integer,
  league_id integer,
  team_players jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists team_matches_start_time_idx on public.team_matches(start_time desc);

alter table public.team_matches enable row level security;
-- Raw team_matches are intentionally not readable by the public.
-- The scheduled sync uses the Supabase service-role key and the website reads only aggregates.

create table if not exists public.team_synergy_stats (
  combination_key text primary key,
  combination_size integer not null check (combination_size between 2 and 5),
  account_ids bigint[] not null,
  player_names text[] not null,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  winrate numeric(5,2) not null default 0,
  avg_duration numeric(10,2),
  avg_kills numeric(10,2),
  avg_deaths numeric(10,2),
  avg_assists numeric(10,2),
  avg_gpm numeric(10,2),
  avg_xpm numeric(10,2),
  last_match_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists team_synergy_size_idx on public.team_synergy_stats(combination_size);
create index if not exists team_synergy_updated_idx on public.team_synergy_stats(updated_at desc);

alter table public.team_synergy_stats enable row level security;
drop policy if exists "public can read synergy stats" on public.team_synergy_stats;
create policy "public can read synergy stats" on public.team_synergy_stats for select using (true);
