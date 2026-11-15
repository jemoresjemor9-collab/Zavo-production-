create policy "creators read completion events for own videos"
on public.video_completion_events for select to authenticated
using (exists(select 1 from public.videos v where v.id=video_completion_events.video_id and v.user_id=(select auth.uid())));
grant select (video_id,created_at) on public.video_completion_events to authenticated;