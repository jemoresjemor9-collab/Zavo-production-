alter table public.zavo_video_retention_events drop constraint if exists zavo_video_retention_events_viewer_id_fkey;
alter table public.zavo_video_retention_events
  add constraint zavo_video_retention_events_viewer_id_fkey
  foreign key(viewer_id) references public.profiles(id) on delete cascade;