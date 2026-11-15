drop policy if exists "zavo members vote once per challenge" on public.zavo_challenge_votes;
create policy "zavo members vote once per challenge" on public.zavo_challenge_votes for insert to authenticated with check (
  voter_id=auth.uid() and exists(
    select 1 from public.zavo_challenge_entries e
    join public.zavo_challenges c on c.id=e.challenge_id
    where e.id=zavo_challenge_votes.entry_id
      and e.challenge_id=zavo_challenge_votes.challenge_id
      and e.user_id<>auth.uid()
      and c.status='active' and now() between c.starts_at and c.ends_at
  )
);
drop policy if exists "zavo members change own challenge vote" on public.zavo_challenge_votes;
create policy "zavo members change own challenge vote" on public.zavo_challenge_votes for update to authenticated
using(voter_id=auth.uid())
with check (
  voter_id=auth.uid() and exists(
    select 1 from public.zavo_challenge_entries e
    join public.zavo_challenges c on c.id=e.challenge_id
    where e.id=zavo_challenge_votes.entry_id
      and e.challenge_id=zavo_challenge_votes.challenge_id
      and e.user_id<>auth.uid()
      and c.status='active' and now() between c.starts_at and c.ends_at
  )
);