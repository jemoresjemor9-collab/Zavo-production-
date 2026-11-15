drop policy if exists "zavo collaborators read their invitations" on public.zavo_video_collaborations;
create policy "zavo collaborators read their invitations" on public.zavo_video_collaborations
for select to anon,authenticated using(
  owner_id=auth.uid()
  or collaborator_id=auth.uid()
  or (status='accepted' and exists(select 1 from public.videos v where v.id=video_id and v.visibility='public' and v.moderation_status='approved'))
);