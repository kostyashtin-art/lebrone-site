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
