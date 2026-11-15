drop policy if exists "zavo owners manage community member roles" on public.zavo_community_members;
create policy "zavo owners manage community member roles" on public.zavo_community_members
for update to authenticated
using(exists(select 1 from public.zavo_communities c where c.id=community_id and c.owner_id=auth.uid()))
with check(role in ('member','moderator') and exists(select 1 from public.zavo_communities c where c.id=community_id and c.owner_id=auth.uid()));

drop policy if exists "zavo owners remove community members" on public.zavo_community_members;
create policy "zavo owners remove community members" on public.zavo_community_members
for delete to authenticated
using(role='member' or role='moderator' and exists(select 1 from public.zavo_communities c where c.id=community_id and c.owner_id=auth.uid()));

drop policy if exists "zavo authors and community managers delete posts" on public.zavo_community_posts;
create policy "zavo authors and community managers delete posts" on public.zavo_community_posts
for delete to authenticated
using(
  author_id=auth.uid()
  or exists(select 1 from public.zavo_communities c where c.id=community_id and c.owner_id=auth.uid())
  or exists(select 1 from public.zavo_community_members m where m.community_id=zavo_community_posts.community_id and m.user_id=auth.uid() and m.role='moderator')
);

drop policy if exists "zavo authors and managers remove community comments" on public.zavo_community_post_comments;
create policy "zavo authors and managers remove community comments" on public.zavo_community_post_comments
for delete to authenticated
using(
  user_id=auth.uid()
  or exists(select 1 from public.zavo_community_posts p join public.zavo_communities c on c.id=p.community_id where p.id=post_id and c.owner_id=auth.uid())
  or exists(select 1 from public.zavo_community_posts p join public.zavo_community_members m on m.community_id=p.community_id where p.id=post_id and m.user_id=auth.uid() and m.role='moderator')
);