drop policy if exists "zavo community members post" on public.zavo_community_posts;
create policy "zavo community members post" on public.zavo_community_posts for insert to authenticated
with check(author_id=(select auth.uid()) and private.zavo_is_community_member(zavo_community_posts.community_id,(select auth.uid())));

drop policy if exists "zavo authors edit community posts" on public.zavo_community_posts;
create policy "zavo authors edit community posts" on public.zavo_community_posts for update to authenticated
using(author_id=(select auth.uid()))
with check(author_id=(select auth.uid()) and private.zavo_is_community_member(zavo_community_posts.community_id,(select auth.uid())));

create index if not exists zavo_challenge_entries_user_idx on public.zavo_challenge_entries(user_id);
create index if not exists zavo_challenge_entries_video_idx on public.zavo_challenge_entries(video_id);
create index if not exists zavo_challenges_creator_idx on public.zavo_challenges(creator_id);
create index if not exists zavo_communities_owner_idx on public.zavo_communities(owner_id);
create index if not exists zavo_community_posts_author_idx on public.zavo_community_posts(author_id);
create index if not exists zavo_series_episodes_video_idx on public.zavo_series_episodes(video_id);
create index if not exists video_completion_events_viewer_idx on public.video_completion_events(viewer_id);
create index if not exists video_open_events_viewer_idx on public.video_open_events(viewer_id);