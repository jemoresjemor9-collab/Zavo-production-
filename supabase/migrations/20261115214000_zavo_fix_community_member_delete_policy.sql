drop policy if exists "zavo owners remove community members" on public.zavo_community_members;
create policy "zavo owners remove community members" on public.zavo_community_members
for delete to authenticated
using(
  (user_id=auth.uid() and role='member')
  or (role in ('member','moderator') and exists(select 1 from public.zavo_communities c where c.id=community_id and c.owner_id=auth.uid()))
);