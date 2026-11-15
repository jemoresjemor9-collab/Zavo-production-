create table if not exists public.zavo_communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,70}$'),
  description text not null default '' check (char_length(description) <= 1000),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.zavo_community_members (
  community_id uuid not null references public.zavo_communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (community_id,user_id)
);
create table if not exists public.zavo_community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.zavo_communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.zavo_series (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1500),
  cover_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.zavo_series_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.zavo_series(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  episode_number integer not null check (episode_number between 1 and 500),
  created_at timestamptz not null default now(),
  unique(series_id,video_id),
  unique(series_id,episode_number)
);
create table if not exists public.zavo_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1500),
  hashtag text not null check (hashtag ~ '^[a-zA-Z0-9_]{2,40}$'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.zavo_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.zavo_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(challenge_id,video_id)
);

create index if not exists zavo_communities_visibility_created_idx on public.zavo_communities(visibility,created_at desc);
create index if not exists zavo_community_members_user_idx on public.zavo_community_members(user_id,joined_at desc);
create index if not exists zavo_community_posts_feed_idx on public.zavo_community_posts(community_id,created_at desc);
create index if not exists zavo_series_creator_idx on public.zavo_series(creator_id,created_at desc);
create index if not exists zavo_series_episodes_order_idx on public.zavo_series_episodes(series_id,episode_number);
create index if not exists zavo_challenges_status_dates_idx on public.zavo_challenges(status,starts_at,ends_at);
create index if not exists zavo_challenge_entries_challenge_idx on public.zavo_challenge_entries(challenge_id,created_at desc);

alter table public.zavo_communities enable row level security;
alter table public.zavo_community_members enable row level security;
alter table public.zavo_community_posts enable row level security;
alter table public.zavo_series enable row level security;
alter table public.zavo_series_episodes enable row level security;
alter table public.zavo_challenges enable row level security;
alter table public.zavo_challenge_entries enable row level security;

grant select on public.zavo_communities,public.zavo_community_members,public.zavo_community_posts,public.zavo_series,public.zavo_series_episodes,public.zavo_challenges,public.zavo_challenge_entries to anon,authenticated;
grant insert,update,delete on public.zavo_communities,public.zavo_community_members,public.zavo_community_posts,public.zavo_series,public.zavo_series_episodes,public.zavo_challenges,public.zavo_challenge_entries to authenticated;

create or replace function private.zavo_add_community_owner()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.zavo_community_members(community_id,user_id,role) values(new.id,new.owner_id,'owner')
  on conflict (community_id,user_id) do nothing;
  return new;
end; $$;
revoke all on function private.zavo_add_community_owner() from public,anon,authenticated;
drop trigger if exists zavo_community_owner_membership on public.zavo_communities;
create trigger zavo_community_owner_membership after insert on public.zavo_communities
for each row execute function private.zavo_add_community_owner();

create policy "zavo communities readable" on public.zavo_communities for select to anon,authenticated
using (visibility='public' or owner_id=(select auth.uid()) or exists(select 1 from public.zavo_community_members m where m.community_id=id and m.user_id=(select auth.uid())));
create policy "zavo community owner creates" on public.zavo_communities for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "zavo community owner updates" on public.zavo_communities for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "zavo community owner deletes" on public.zavo_communities for delete to authenticated using(owner_id=(select auth.uid()));

create policy "zavo community membership readable" on public.zavo_community_members for select to authenticated
using (user_id=(select auth.uid()) or exists(select 1 from public.zavo_communities c where c.id=community_id and c.visibility='public') or exists(select 1 from public.zavo_community_members m where m.community_id=community_id and m.user_id=(select auth.uid())));
create policy "zavo members join public communities" on public.zavo_community_members for insert to authenticated
with check(user_id=(select auth.uid()) and role='member' and exists(select 1 from public.zavo_communities c where c.id=community_id and c.visibility='public'));
create policy "zavo members leave community" on public.zavo_community_members for delete to authenticated
using(user_id=(select auth.uid()) and role='member');

create policy "zavo community posts readable" on public.zavo_community_posts for select to anon,authenticated
using (exists(select 1 from public.zavo_communities c where c.id=community_id and c.visibility='public') or exists(select 1 from public.zavo_community_members m where m.community_id=community_id and m.user_id=(select auth.uid())));
create policy "zavo community members post" on public.zavo_community_posts for insert to authenticated
with check(author_id=(select auth.uid()) and exists(select 1 from public.zavo_community_members m where m.community_id=community_id and m.user_id=(select auth.uid())));
create policy "zavo authors edit community posts" on public.zavo_community_posts for update to authenticated
using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()) and exists(select 1 from public.zavo_community_members m where m.community_id=community_id and m.user_id=(select auth.uid())));
create policy "zavo authors delete community posts" on public.zavo_community_posts for delete to authenticated
using(author_id=(select auth.uid()));

create policy "zavo series readable" on public.zavo_series for select to anon,authenticated
using(is_public or creator_id=(select auth.uid()));
create policy "zavo creators create series" on public.zavo_series for insert to authenticated with check(creator_id=(select auth.uid()));
create policy "zavo creators update series" on public.zavo_series for update to authenticated using(creator_id=(select auth.uid())) with check(creator_id=(select auth.uid()));
create policy "zavo creators delete series" on public.zavo_series for delete to authenticated using(creator_id=(select auth.uid()));
create policy "zavo series episodes readable" on public.zavo_series_episodes for select to anon,authenticated
using(exists(select 1 from public.zavo_series s where s.id=series_id and (s.is_public or s.creator_id=(select auth.uid()))));
create policy "zavo creators add own episodes" on public.zavo_series_episodes for insert to authenticated
with check(exists(select 1 from public.zavo_series s join public.videos v on v.id=video_id where s.id=series_id and s.creator_id=(select auth.uid()) and v.user_id=(select auth.uid())));
create policy "zavo creators remove own episodes" on public.zavo_series_episodes for delete to authenticated
using(exists(select 1 from public.zavo_series s where s.id=series_id and s.creator_id=(select auth.uid())));

create policy "zavo challenges readable" on public.zavo_challenges for select to anon,authenticated using(true);
create policy "zavo creators create challenges" on public.zavo_challenges for insert to authenticated with check(creator_id=(select auth.uid()));
create policy "zavo creators update challenges" on public.zavo_challenges for update to authenticated using(creator_id=(select auth.uid())) with check(creator_id=(select auth.uid()));
create policy "zavo creators delete challenges" on public.zavo_challenges for delete to authenticated using(creator_id=(select auth.uid()));
create policy "zavo challenge entries readable" on public.zavo_challenge_entries for select to anon,authenticated using(true);
create policy "zavo members submit own challenge videos" on public.zavo_challenge_entries for insert to authenticated
with check(user_id=(select auth.uid()) and exists(select 1 from public.videos v join public.zavo_challenges c on c.id=challenge_id where v.id=video_id and v.user_id=(select auth.uid()) and c.status='active' and now() between c.starts_at and c.ends_at));
create policy "zavo members remove own challenge entries" on public.zavo_challenge_entries for delete to authenticated
using(user_id=(select auth.uid()));
