alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
check (kind = any (array['like','comment','comment_like','follow','message','campaign','system','moderation','mention']::text[]));

create or replace function private.zavo_notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  mentioned record;
  author_name text;
begin
  select coalesce(display_name,username,'Un membre ZAVO') into author_name
  from public.profiles where id=new.user_id;

  for mentioned in
    select distinct p.id,p.username
    from regexp_matches(new.body,'@([A-Za-z0-9_]{3,30})','g') as match_result(parts)
    join public.profiles p on lower(p.username)=lower(match_result.parts[1])
    where p.id<>new.user_id
  loop
    insert into public.notifications(recipient_id,actor_id,kind,entity_id,title,body)
    values(mentioned.id,new.user_id,'mention',new.video_id,'Tu as été mentionné',
      left(coalesce(author_name,'Un membre ZAVO')||' t’a mentionné dans un commentaire.',240));
  end loop;
  return new;
end;
$$;
revoke all on function private.zavo_notify_comment_mentions() from public,anon,authenticated;
drop trigger if exists zavo_comment_mentions_notification on public.comments;
create trigger zavo_comment_mentions_notification
after insert on public.comments
for each row execute function private.zavo_notify_comment_mentions();