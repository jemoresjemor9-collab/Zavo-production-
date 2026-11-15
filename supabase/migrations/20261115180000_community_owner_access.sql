-- Treat a community owner as a member for private discussion access.
-- This keeps owner posting and reading consistent with the application UI.
create or replace function private.zavo_is_community_member(p_community_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    exists (
      select 1
      from public.zavo_community_members m
      where m.community_id = p_community_id
        and m.user_id = p_user_id
    )
    or exists (
      select 1
      from public.zavo_communities c
      where c.id = p_community_id
        and c.owner_id = p_user_id
    );
$function$;
