-- 4T1J Highlights: run in Supabase SQL Editor
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  player text not null,
  hero text default '',
  video_url text not null,
  thumbnail_url text default '',
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.highlights enable row level security;
create policy "public can read published highlights" on public.highlights for select using (is_published = true);
create policy "authenticated can read all highlights" on public.highlights for select to authenticated using (true);
create policy "authenticated can insert highlights" on public.highlights for insert to authenticated with check (true);
create policy "authenticated can update highlights" on public.highlights for update to authenticated using (true) with check (true);
create policy "authenticated can delete highlights" on public.highlights for delete to authenticated using (true);

insert into storage.buckets (id, name, public) values ('highlights','highlights',true) on conflict (id) do nothing;
create policy "public can view highlight files" on storage.objects for select using (bucket_id = 'highlights');
create policy "authenticated can upload highlight files" on storage.objects for insert to authenticated with check (bucket_id = 'highlights');
create policy "authenticated can update highlight files" on storage.objects for update to authenticated using (bucket_id = 'highlights') with check (bucket_id = 'highlights');
create policy "authenticated can delete highlight files" on storage.objects for delete to authenticated using (bucket_id = 'highlights');


-- Боевые кубки: один результат на один сыгранный кубок
create table if not exists public.battle_cups (
  id uuid primary key default gen_random_uuid(),
  cup_date date not null,
  result text not null check (result in ('win','loss')),
  score text default '',
  opponent text default '',
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.battle_cups enable row level security;
create policy "public can read battle cup results" on public.battle_cups for select using (true);
create policy "authenticated can insert battle cup results" on public.battle_cups for insert to authenticated with check (true);
create policy "authenticated can delete battle cup results" on public.battle_cups for delete to authenticated using (true);
