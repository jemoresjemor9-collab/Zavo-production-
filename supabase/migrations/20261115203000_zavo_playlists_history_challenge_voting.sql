create table if not exists public.zavo_playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zavo_playlists_owner_updated_idx on public.zavo_playlists(owner_id,updated_at desc);
create table if not exists public.zavo_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.zavo_playlists(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique(playlist_id,video_id)
);
create index if not exists zavo_playlist_items_playlist_idx on public.zavo_playlist_items(playlist_id,added_at desc);
create index if not exists zavo_playlist_items_video_idx on public.zavo_playlist_items(video_id);
alter table public.zavo_playlists enable row level security;
alter table public.zavo_playlist_items enable row level security;
drop policy if exists "zavo playlists visible to owner or public" on public.zavo_playlists;
create policy "zavo playlists visible to owner or public" on public.zavo_playlists for select to anon,authenticated using (visibility='public' or owner_id=auth.uid());
drop policy if exists "zavo users create own playlists" on public.zavo_playlists;
create policy "zavo users create own playlists" on public.zavo_playlists for insert to authenticated with check (owner_id=auth.uid());
drop policy if exists "zavo owners update playlists" on public.zavo_playlists;
create policy "zavo owners update playlists" on public.zavo_playlists for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "zavo owners delete playlists" on public.zavo_playlists;
create policy "zavo owners delete playlists" on public.zavo_playlists for delete to authenticated using (owner_id=auth.uid());
drop policy if exists "zavo playlist items visible with playlist" on public.zavo_playlist_items;
create policy "zavo playlist items visible with playlist" on public.zavo_playlist_items for select to anon,authenticated using (exists(select 1 from public.zavo_playlists p where p.id=playlist_id and (p.visibility='public' or p.owner_id=auth.uid())));
drop policy if exists "zavo owners add playlist items" on public.zavo_playlist_items;
create policy "zavo owners add playlist items" on public.zavo_playlist_items for insert to authenticated with check (exists(select 1 from public.zavo_playlists p where p.id=playlist_id and p.owner_id=auth.uid()) and exists(select 1 from public.videos v where v.id=video_id and (v.user_id=auth.uid() or (v.visibility='public' and v.moderation_status='approved'))));
drop policy if exists "zavo owners remove playlist items" on public.zavo_playlist_items;
create policy "zavo owners remove playlist items" on public.zavo_playlist_items for delete to authenticated using (exists(select 1 from public.zavo_playlists p where p.id=playlist_id and p.owner_id=auth.uid()));
create table if not exists public.zavo_watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  watch_seconds bigint not null default 0 check (watch_seconds >= 0),
  last_watched_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id,video_id)
);
create index if not exists zavo_watch_history_user_recent_idx on public.zavo_watch_history(user_id,last_watched_at desc);
alter table public.zavo_watch_history enable row level security;
drop policy if exists "zavo users read own watch history" on public.zavo_watch_history;
create policy "zavo users read own watch history" on public.zavo_watch_history for select to authenticated using(user_id=auth.uid());
drop policy if exists "zavo users delete own watch history" on public.zavo_watch_history;
create policy "zavo users delete own watch history" on public.zavo_watch_history for delete to authenticated using(user_id=auth.uid());
create or replace function public.zavo_record_watch_history(p_video_id uuid,p_watch_seconds integer default 0,p_completed boolean default false)
returns void language plpgsql security definer set search_path=public,private as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  if not exists(select 1 from public.videos v where v.id=p_video_id and (v.user_id=v_user or (v.visibility='public' and v.moderation_status='approved'))) then raise exception 'Video unavailable'; end if;
  insert into public.zavo_watch_history(user_id,video_id,watch_seconds,last_watched_at,completed_at)
  values(v_user,p_video_id,greatest(0,least(coalesce(p_watch_seconds,0),86400)),now(),case when p_completed then now() else null end)
  on conflict(user_id,video_id) do update set watch_seconds=least(public.zavo_watch_history.watch_seconds+excluded.watch_seconds,2147483647),last_watched_at=now(),completed_at=case when p_completed then now() else public.zavo_watch_history.completed_at end;
end; $$;
revoke all on function public.zavo_record_watch_history(uuid,integer,boolean) from public,anon;
grant execute on function public.zavo_record_watch_history(uuid,integer,boolean) to authenticated;
create table if not exists public.zavo_challenge_votes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.zavo_challenges(id) on delete cascade,
  entry_id uuid not null references public.zavo_challenge_entries(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id,voter_id)
);
create index if not exists zavo_challenge_votes_entry_idx on public.zavo_challenge_votes(entry_id);
alter table public.zavo_challenge_votes enable row level security;
drop policy if exists "zavo challenge vote counts readable" on public.zavo_challenge_votes;
create policy "zavo challenge vote counts readable" on public.zavo_challenge_votes for select to anon,authenticated using(true);
drop policy if exists "zavo members vote once per challenge" on public.zavo_challenge_votes;
create policy "zavo members vote once per challenge" on public.zavo_challenge_votes for insert to authenticated with check (
  voter_id=auth.uid() and exists(select 1 from public.zavo_challenge_entries e join public.zavo_challenges c on c.id=e.challenge_id where e.id=entry_id and e.challenge_id=zavo_challenge_votes.challenge_id and e.user_id<>auth.uid() and c.status='active' and now() between c.starts_at and c.ends_at)
);
drop policy if exists "zavo members change own challenge vote" on public.zavo_challenge_votes;
create policy "zavo members change own challenge vote" on public.zavo_challenge_votes for update to authenticated using(voter_id=auth.uid()) with check (
  voter_id=auth.uid() and exists(select 1 from public.zavo_challenge_entries e join public.zavo_challenges c on c.id=e.challenge_id where e.id=entry_id and e.challenge_id=zavo_challenge_votes.challenge_id and e.user_id<>auth.uid() and c.status='active' and now() between c.starts_at and c.ends_at)
);
drop policy if exists "zavo members remove own challenge vote" on public.zavo_challenge_votes;
create policy "zavo members remove own challenge vote" on public.zavo_challenge_votes for delete to authenticated using(voter_id=auth.uid());