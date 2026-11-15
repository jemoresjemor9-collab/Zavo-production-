create or replace function private.zavo_is_community_member(p_community_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.zavo_community_members m where m.community_id=p_community_id and m.user_id=p_user_id);
$$;
revoke all on function private.zavo_is_community_member(uuid,uuid) from public;
grant execute on function private.zavo_is_community_member(uuid,uuid) to anon,authenticated;

drop policy if exists "zavo communities readable" on public.zavo_communities;
create policy "zavo communities readable" on public.zavo_communities for select to anon,authenticated
using (visibility='public' or owner_id=(select auth.uid()) or private.zavo_is_community_member(id,(select auth.uid())));

drop policy if exists "zavo community membership readable" on public.zavo_community_members;
create policy "zavo community membership readable" on public.zavo_community_members for select to authenticated
using (user_id=(select auth.uid()) or exists(select 1 from public.zavo_communities c where c.id=zavo_community_members.community_id and c.owner_id=(select auth.uid())));

drop policy if exists "zavo community posts readable" on public.zavo_community_posts;
create policy "zavo community posts readable" on public.zavo_community_posts for select to anon,authenticated
using (exists(select 1 from public.zavo_communities c where c.id=zavo_community_posts.community_id and c.visibility='public') or private.zavo_is_community_member(zavo_community_posts.community_id,(select auth.uid())));