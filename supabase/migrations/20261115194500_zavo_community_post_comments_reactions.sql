create table if not exists public.zavo_community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.zavo_community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists zavo_community_post_comments_post_created_idx
  on public.zavo_community_post_comments(post_id, created_at desc);

create table if not exists public.zavo_community_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.zavo_community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);
create index if not exists zavo_community_post_reactions_post_idx
  on public.zavo_community_post_reactions(post_id);

alter table public.zavo_community_post_comments enable row level security;
alter table public.zavo_community_post_reactions enable row level security;

drop policy if exists "zavo community post comments readable by members" on public.zavo_community_post_comments;
create policy "zavo community post comments readable by members"
on public.zavo_community_post_comments for select to authenticated
using (exists (select 1 from public.zavo_community_posts p where p.id=post_id and private.zavo_is_community_member(p.community_id,auth.uid())));

drop policy if exists "zavo community members comment on posts" on public.zavo_community_post_comments;
create policy "zavo community members comment on posts"
on public.zavo_community_post_comments for insert to authenticated
with check (user_id=auth.uid() and exists (select 1 from public.zavo_community_posts p where p.id=post_id and private.zavo_is_community_member(p.community_id,auth.uid())));

drop policy if exists "zavo authors and owners remove community comments" on public.zavo_community_post_comments;
create policy "zavo authors and owners remove community comments"
on public.zavo_community_post_comments for delete to authenticated
using (user_id=auth.uid() or exists (select 1 from public.zavo_community_posts p join public.zavo_communities c on c.id=p.community_id where p.id=post_id and c.owner_id=auth.uid()));

drop policy if exists "zavo community post reactions readable by members" on public.zavo_community_post_reactions;
create policy "zavo community post reactions readable by members"
on public.zavo_community_post_reactions for select to authenticated
using (exists (select 1 from public.zavo_community_posts p where p.id=post_id and private.zavo_is_community_member(p.community_id,auth.uid())));

drop policy if exists "zavo community members react to posts" on public.zavo_community_post_reactions;
create policy "zavo community members react to posts"
on public.zavo_community_post_reactions for insert to authenticated
with check (user_id=auth.uid() and exists (select 1 from public.zavo_community_posts p where p.id=post_id and private.zavo_is_community_member(p.community_id,auth.uid())));

drop policy if exists "zavo members remove own community reactions" on public.zavo_community_post_reactions;
create policy "zavo members remove own community reactions"
on public.zavo_community_post_reactions for delete to authenticated
using (user_id=auth.uid());