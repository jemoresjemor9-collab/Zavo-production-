ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.video_drafts
  ADD COLUMN IF NOT EXISTS title text;
