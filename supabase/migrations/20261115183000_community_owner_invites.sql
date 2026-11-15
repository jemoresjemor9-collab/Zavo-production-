-- Allow community owners to add members to their own communities.
create policy "zavo community owners invite members"
on public.zavo_community_members
for insert
to authenticated
with check (
  role = 'member'
  and exists (
    select 1
    from public.zavo_communities c
    where c.id = community_id
      and c.owner_id = (select auth.uid())
  )
);
