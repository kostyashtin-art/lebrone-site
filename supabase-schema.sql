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
drop policy if exists "public can read published highlights" on public.highlights;
drop policy if exists "authenticated can read all highlights" on public.highlights;
drop policy if exists "authenticated can insert highlights" on public.highlights;
drop policy if exists "authenticated can update highlights" on public.highlights;
drop policy if exists "authenticated can delete highlights" on public.highlights;
drop policy if exists "admin can read all highlights" on public.highlights;
drop policy if exists "admin can insert highlights" on public.highlights;
drop policy if exists "admin can update highlights" on public.highlights;
drop policy if exists "admin can delete highlights" on public.highlights;
create policy "public can read published highlights" on public.highlights for select using (is_published = true);
-- Только пользователи, добавленные в admin_users, получают права управления.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
drop policy if exists "users can check own admin row" on public.admin_users;
create policy "users can check own admin row" on public.admin_users for select to authenticated using (user_id = auth.uid());

-- ВАЖНО: после создания пользователя в Supabase добавьте его UUID: \n-- insert into public.admin_users (user_id) values ('ВАШ-UUID-ИЗ-SUPABASE');

create policy "admin can read all highlights" on public.highlights for select to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()) or is_published = true);
create policy "admin can insert highlights" on public.highlights for insert to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admin can update highlights" on public.highlights for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admin can delete highlights" on public.highlights for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

insert into storage.buckets (id, name, public) values ('highlights','highlights',true) on conflict (id) do nothing;
drop policy if exists "public can view highlight files" on storage.objects;
drop policy if exists "authenticated can upload highlight files" on storage.objects;
drop policy if exists "authenticated can update highlight files" on storage.objects;
drop policy if exists "authenticated can delete highlight files" on storage.objects;
drop policy if exists "admin can upload highlight files" on storage.objects;
drop policy if exists "admin can update highlight files" on storage.objects;
drop policy if exists "admin can delete highlight files" on storage.objects;
create policy "public can view highlight files" on storage.objects for select using (bucket_id = 'highlights');
create policy "admin can upload highlight files" on storage.objects for insert to authenticated with check (bucket_id = 'highlights' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admin can update highlight files" on storage.objects for update to authenticated using (bucket_id = 'highlights' and exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (bucket_id = 'highlights' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admin can delete highlight files" on storage.objects for delete to authenticated using (bucket_id = 'highlights' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));


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
drop policy if exists "public can read battle cup results" on public.battle_cups;
drop policy if exists "authenticated can insert battle cup results" on public.battle_cups;
drop policy if exists "authenticated can delete battle cup results" on public.battle_cups;
drop policy if exists "admin can insert battle cup results" on public.battle_cups;
drop policy if exists "admin can delete battle cup results" on public.battle_cups;
create policy "public can read battle cup results" on public.battle_cups for select using (true);
create policy "admin can insert battle cup results" on public.battle_cups for insert to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admin can delete battle cup results" on public.battle_cups for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
