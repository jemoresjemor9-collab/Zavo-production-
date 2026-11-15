create table if not exists public.zavo_video_retention_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  visitor_key text,
  playback_session_id uuid not null,
  milestone smallint not null check (milestone in (10,25,50,75,90,100)),
  created_at timestamptz not null default now(),
  unique(playback_session_id,milestone),
  check ((viewer_id is not null and visitor_key is null) or (viewer_id is null and visitor_key is not null))
);
create index if not exists zavo_video_retention_creator_video_idx on public.zavo_video_retention_events(creator_id,video_id,created_at desc);
create index if not exists zavo_video_retention_video_milestone_idx on public.zavo_video_retention_events(video_id,milestone);
alter table public.zavo_video_retention_events enable row level security;
drop policy if exists "zavo creators read own retention events" on public.zavo_video_retention_events;
create policy "zavo creators read own retention events" on public.zavo_video_retention_events
for select to authenticated using(creator_id=auth.uid());
drop policy if exists "zavo viewers record approved video retention" on public.zavo_video_retention_events;
create policy "zavo viewers record approved video retention" on public.zavo_video_retention_events
for insert to anon,authenticated with check (
  exists(select 1 from public.videos v where v.id=video_id and v.user_id=creator_id and v.visibility='public' and v.moderation_status='approved')
  and ((auth.uid() is null and viewer_id is null and visitor_key is not null) or (auth.uid() is not null and viewer_id=auth.uid() and visitor_key is null))
);