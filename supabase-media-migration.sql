-- Run this once in Supabase SQL Editor if public.highlights already exists.
alter table public.highlights alter column video_url drop not null;
alter table public.highlights add column if not exists media_type text not null default 'highlight';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'highlights_media_type_check'
      AND conrelid = 'public.highlights'::regclass
  ) THEN
    ALTER TABLE public.highlights
      ADD CONSTRAINT highlights_media_type_check CHECK (media_type IN ('photo','video','highlight'));
  END IF;
END $$;
