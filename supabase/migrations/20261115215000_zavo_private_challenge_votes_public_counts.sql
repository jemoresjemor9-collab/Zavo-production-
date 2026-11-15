drop policy if exists "zavo challenge vote counts readable" on public.zavo_challenge_votes;
create policy "zavo users read own challenge votes" on public.zavo_challenge_votes
for select to authenticated using(voter_id=auth.uid());

create or replace view public.zavo_challenge_vote_counts
with (security_invoker=false)
as
select challenge_id,entry_id,count(*)::bigint as vote_count
from public.zavo_challenge_votes
group by challenge_id,entry_id;

grant select on public.zavo_challenge_vote_counts to anon,authenticated;