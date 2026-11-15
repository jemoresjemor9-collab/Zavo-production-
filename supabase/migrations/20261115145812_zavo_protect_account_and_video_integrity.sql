create or replace function private.guard_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if current_user in ('postgres', 'service_role') or private.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.account_status is distinct from old.account_status then
    raise exception 'Modification de champs de compte réservée à l’administration.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists zavo_guard_profile_sensitive_fields on public.profiles;
create trigger zavo_guard_profile_sensitive_fields
before update on public.profiles
for each row execute function private.guard_profile_sensitive_fields();

create or replace function private.guard_video_integrity_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if current_user in ('postgres', 'service_role') or private.is_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.moderation_status is distinct from old.moderation_status
     or new.views_count is distinct from old.views_count
     or new.clicks_count is distinct from old.clicks_count
     or new.watch_time_seconds is distinct from old.watch_time_seconds
     or new.completed_views_count is distinct from old.completed_views_count
     or new.created_at is distinct from old.created_at then
    raise exception 'Modification de champs protégés de publication ou de statistiques interdite.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists zavo_guard_video_integrity_fields on public.videos;
create trigger zavo_guard_video_integrity_fields
before update on public.videos
for each row execute function private.guard_video_integrity_fields();

revoke all on function public.bump_video_click_count() from public, anon, authenticated;
revoke all on function public.bump_video_completion_count() from public, anon, authenticated;
revoke all on function public.bump_video_watch_time() from public, anon, authenticated;
