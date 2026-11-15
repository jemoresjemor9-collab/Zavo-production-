create table if not exists public.zavo_video_collaborations (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  collaborator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(video_id,collaborator_id),
  check(owner_id<>collaborator_id)
);
create index if not exists zavo_video_collaborations_owner_idx on public.zavo_video_collaborations(owner_id,created_at desc);
create index if not exists zavo_video_collaborations_collaborator_idx on public.zavo_video_collaborations(collaborator_id,status,created_at desc);
alter table public.zavo_video_collaborations enable row level security;
drop policy if exists "zavo collaborators read their invitations" on public.zavo_video_collaborations;
create policy "zavo collaborators read their invitations" on public.zavo_video_collaborations
for select to authenticated using(owner_id=auth.uid() or collaborator_id=auth.uid());
drop policy if exists "zavo video owners invite collaborators" on public.zavo_video_collaborations;
create policy "zavo video owners invite collaborators" on public.zavo_video_collaborations
for insert to authenticated with check(
  owner_id=auth.uid() and status='pending'
  and exists(select 1 from public.videos v where v.id=video_id and v.user_id=auth.uid() and v.visibility='public' and v.moderation_status='approved')
  and exists(select 1 from public.profiles p where p.id=collaborator_id and p.account_status='active')
);
drop policy if exists "zavo invited creators respond" on public.zavo_video_collaborations;
create policy "zavo invited creators respond" on public.zavo_video_collaborations
for update to authenticated using(collaborator_id=auth.uid() and status='pending')
with check(collaborator_id=auth.uid() and status in ('accepted','rejected'));
drop policy if exists "zavo collaboration participants cancel" on public.zavo_video_collaborations;
create policy "zavo collaboration participants cancel" on public.zavo_video_collaborations
for delete to authenticated using(owner_id=auth.uid() or collaborator_id=auth.uid());

create table if not exists public.zavo_video_remixes (
  id uuid primary key default gen_random_uuid(),
  original_video_id uuid not null references public.videos(id) on delete cascade,
  remix_video_id uuid not null unique references public.videos(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  remix_type text not null default 'remix' check(remix_type in ('duet','remix')),
  created_at timestamptz not null default now(),
  check(original_video_id<>remix_video_id)
);
create index if not exists zavo_video_remixes_original_idx on public.zavo_video_remixes(original_video_id,created_at desc);
alter table public.zavo_video_remixes enable row level security;
drop policy if exists "zavo public remixes readable" on public.zavo_video_remixes;
create policy "zavo public remixes readable" on public.zavo_video_remixes
for select to anon,authenticated using(
  exists(select 1 from public.videos o where o.id=original_video_id and o.visibility='public' and o.moderation_status='approved')
  and exists(select 1 from public.videos r where r.id=remix_video_id and r.visibility='public' and r.moderation_status='approved')
);
drop policy if exists "zavo creators register own remixes" on public.zavo_video_remixes;
create policy "zavo creators register own remixes" on public.zavo_video_remixes
for insert to authenticated with check(
  creator_id=auth.uid()
  and exists(select 1 from public.videos r where r.id=remix_video_id and r.user_id=auth.uid() and r.visibility='public' and r.moderation_status='approved')
  and exists(select 1 from public.videos o where o.id=original_video_id and o.visibility='public' and o.moderation_status='approved')
);
drop policy if exists "zavo remix creators remove attribution" on public.zavo_video_remixes;
create policy "zavo remix creators remove attribution" on public.zavo_video_remixes
for delete to authenticated using(creator_id=auth.uid());